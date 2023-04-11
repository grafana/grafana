import { each, find, findIndex, flattenDeep, isArray, isBoolean, isNumber, isString, map, max, some } from 'lodash';

import {
  AnnotationQuery,
  DataLink,
  DataLinkBuiltInVars,
  DataQuery,
  DataSourceRef,
  FieldConfigSource,
  FieldMatcherID,
  FieldType,
  getActiveThreshold,
  getDataSourceRef,
  isDataSourceRef,
  MappingType,
  PanelPlugin,
  SpecialValueMatch,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  ThresholdsConfig,
  urlUtil,
  ValueMap,
  ValueMapping,
} from '@grafana/data';
import { labelsToFieldsTransformer } from '@grafana/data/src/transformations/transformers/labelsToFields';
import { mergeTransformer } from '@grafana/data/src/transformations/transformers/merge';
import { getDataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { DataTransformerConfig } from '@grafana/schema';
import { AxisPlacement, GraphFieldConfig } from '@grafana/ui';
import { migrateTableDisplayModeToCellOptions } from '@grafana/ui/src/components/Table/utils';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { config } from 'app/core/config';
import {
  DEFAULT_PANEL_SPAN,
  DEFAULT_ROW_HEIGHT,
  GRID_CELL_HEIGHT,
  GRID_CELL_VMARGIN,
  GRID_COLUMN_COUNT,
  MIN_PANEL_HEIGHT,
} from 'app/core/constants';
import getFactors from 'app/core/utils/factors';
import kbn from 'app/core/utils/kbn';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { isConstant, isMulti } from 'app/features/variables/guard';
import { alignCurrentWithMulti } from 'app/features/variables/shared/multiOptions';
import { CloudWatchMetricsQuery, LegacyAnnotationQuery } from 'app/plugins/datasource/cloudwatch/types';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { plugin as gaugePanelPlugin } from 'app/plugins/panel/gauge/module';
import { plugin as statPanelPlugin } from 'app/plugins/panel/stat/module';

import {
  migrateCloudWatchQuery,
  migrateMultipleStatsAnnotationQuery,
  migrateMultipleStatsMetricsQuery,
} from '../../../plugins/datasource/cloudwatch/migrations/dashboardMigrations';
import { ConstantVariableModel, TextBoxVariableModel, VariableHide } from '../../variables/types';

import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

type PanelSchemeUpgradeHandler = (panel: PanelModel) => PanelModel;
export class DashboardMigrator {
  dashboard: DashboardModel;

  constructor(dashboardModel: DashboardModel) {
    this.dashboard = dashboardModel;

    // for tests to pass
    if (!getDataSourceSrv()) {
      setDataSourceSrv(new DatasourceSrv());
    }
  }

  updateSchema(old: any) {
    let i, j, k, n;
    const oldVersion = this.dashboard.schemaVersion;
    const panelUpgrades: PanelSchemeUpgradeHandler[] = [];
    this.dashboard.schemaVersion = 38;

    if (oldVersion === this.dashboard.schemaVersion) {
      return;
    }

    // version 2 schema changes
    if (oldVersion < 2) {
      if (old.services) {
        if (old.services.filter) {
          this.dashboard.time = old.services.filter.time;
          this.dashboard.templating.list = old.services.filter.list || [];
        }
      }

      panelUpgrades.push((panel: any) => {
        // rename panel type
        if (panel.type === 'graphite') {
          panel.type = 'graph';
        }

        if (panel.type !== 'graph') {
          return panel;
        }

        if (isBoolean(panel.legend)) {
          panel.legend = { show: panel.legend };
        }

        if (panel.grid) {
          if (panel.grid.min) {
            panel.grid.leftMin = panel.grid.min;
            delete panel.grid.min;
          }

          if (panel.grid.max) {
            panel.grid.leftMax = panel.grid.max;
            delete panel.grid.max;
          }
        }

        if (panel.y_format) {
          if (!panel.y_formats) {
            panel.y_formats = [];
          }
          panel.y_formats[0] = panel.y_format;
          delete panel.y_format;
        }

        if (panel.y2_format) {
          if (!panel.y_formats) {
            panel.y_formats = [];
          }
          panel.y_formats[1] = panel.y2_format;
          delete panel.y2_format;
        }

        return panel;
      });
    }

    // schema version 3 changes
    if (oldVersion < 3) {
      // ensure panel IDs
      let maxId = this.dashboard.getNextPanelId();
      panelUpgrades.push((panel: any) => {
        if (!panel.id) {
          panel.id = maxId;
          maxId += 1;
        }

        return panel;
      });
    }

    // schema version 4 changes
    if (oldVersion < 4) {
      // move aliasYAxis changes
      panelUpgrades.push((panel: any) => {
        if (panel.type !== 'graph') {
          return panel;
        }

        each(panel.aliasYAxis, (value, key) => {
          panel.seriesOverrides = [{ alias: key, yaxis: value }];
        });

        delete panel.aliasYAxis;

        return panel;
      });
    }

    if (oldVersion < 6) {
      // move drop-downs to new schema
      const annotations: any = find(old.pulldowns, { type: 'annotations' });

      if (annotations) {
        this.dashboard.annotations = {
          list: annotations.annotations || [],
        };
      }

      // update template variables
      for (i = 0; i < this.dashboard.templating.list.length; i++) {
        const variable = this.dashboard.templating.list[i];
        if (variable.datasource === void 0) {
          variable.datasource = null;
        }
        if (variable.type === 'filter') {
          variable.type = 'query';
        }
        if (variable.type === void 0) {
          variable.type = 'query';
        }
        if (variable.allFormat === void 0) {
          variable.allFormat = 'glob';
        }
      }
    }

    if (oldVersion < 7) {
      if (old.nav && old.nav.length) {
        this.dashboard.timepicker = old.nav[0];
      }

      // ensure query refIds
      panelUpgrades.push((panel: any) => {
        each(panel.targets, (target) => {
          if (!target.refId) {
            target.refId = panel.getNextQueryLetter && panel.getNextQueryLetter();
          }
        });

        return panel;
      });
    }

    if (oldVersion < 8) {
      panelUpgrades.push((panel: any) => {
        each(panel.targets, (target) => {
          // update old influxdb query schema
          if (target.fields && target.tags && target.groupBy) {
            if (target.rawQuery) {
              delete target.fields;
              delete target.fill;
            } else {
              target.select = map(target.fields, (field) => {
                const parts = [];
                parts.push({ type: 'field', params: [field.name] });
                parts.push({ type: field.func, params: [] });
                if (field.mathExpr) {
                  parts.push({ type: 'math', params: [field.mathExpr] });
                }
                if (field.asExpr) {
                  parts.push({ type: 'alias', params: [field.asExpr] });
                }
                return parts;
              });
              delete target.fields;
              each(target.groupBy, (part) => {
                if (part.type === 'time' && part.interval) {
                  part.params = [part.interval];
                  delete part.interval;
                }
                if (part.type === 'tag' && part.key) {
                  part.params = [part.key];
                  delete part.key;
                }
              });

              if (target.fill) {
                target.groupBy.push({ type: 'fill', params: [target.fill] });
                delete target.fill;
              }
            }
          }
        });

        return panel;
      });
    }

    // schema version 9 changes
    if (oldVersion < 9) {
      // move aliasYAxis changes
      panelUpgrades.push((panel: any) => {
        if (panel.type !== 'singlestat' && panel.thresholds !== '') {
          return panel;
        }

        if (panel.thresholds) {
          const k = panel.thresholds.split(',');

          if (k.length >= 3) {
            k.shift();
            panel.thresholds = k.join(',');
          }
        }

        return panel;
      });
    }

    // schema version 10 changes
    if (oldVersion < 10) {
      // move aliasYAxis changes
      panelUpgrades.push((panel: any) => {
        if (panel.type !== 'table') {
          return panel;
        }

        each(panel.styles, (style) => {
          if (style.thresholds && style.thresholds.length >= 3) {
            const k = style.thresholds;
            k.shift();
            style.thresholds = k;
          }
        });

        return panel;
      });
    }

    if (oldVersion < 12) {
      // update template variables
      each(this.dashboard.getVariables(), (templateVariable: any) => {
        if (templateVariable.refresh) {
          templateVariable.refresh = 1;
        }
        if (!templateVariable.refresh) {
          templateVariable.refresh = 0;
        }
        if (templateVariable.hideVariable) {
          templateVariable.hide = 2;
        } else if (templateVariable.hideLabel) {
          templateVariable.hide = 1;
        }
      });
    }

    if (oldVersion < 12) {
      // update graph yaxes changes
      panelUpgrades.push((panel: any) => {
        if (panel.type !== 'graph') {
          return panel;
        }
        if (!panel.grid) {
          return panel;
        }

        if (!panel.yaxes) {
          panel.yaxes = [
            {
              show: panel['y-axis'],
              min: panel.grid.leftMin,
              max: panel.grid.leftMax,
              logBase: panel.grid.leftLogBase,
              format: panel.y_formats[0],
              label: panel.leftYAxisLabel,
            },
            {
              show: panel['y-axis'],
              min: panel.grid.rightMin,
              max: panel.grid.rightMax,
              logBase: panel.grid.rightLogBase,
              format: panel.y_formats[1],
              label: panel.rightYAxisLabel,
            },
          ];

          panel.xaxis = {
            show: panel['x-axis'],
          };

          delete panel.grid.leftMin;
          delete panel.grid.leftMax;
          delete panel.grid.leftLogBase;
          delete panel.grid.rightMin;
          delete panel.grid.rightMax;
          delete panel.grid.rightLogBase;
          delete panel.y_formats;
          delete panel.leftYAxisLabel;
          delete panel.rightYAxisLabel;
          delete panel['y-axis'];
          delete panel['x-axis'];
        }

        return panel;
      });
    }

    if (oldVersion < 13) {
      // update graph yaxes changes
      panelUpgrades.push((panel: any) => {
        if (panel.type !== 'graph') {
          return panel;
        }
        if (!panel.grid) {
          return panel;
        }

        if (!panel.thresholds) {
          panel.thresholds = [];
        }
        const t1: any = {},
          t2: any = {};

        if (panel.grid.threshold1 !== null) {
          t1.value = panel.grid.threshold1;
          if (panel.grid.thresholdLine) {
            t1.line = true;
            t1.lineColor = panel.grid.threshold1Color;
            t1.colorMode = 'custom';
          } else {
            t1.fill = true;
            t1.fillColor = panel.grid.threshold1Color;
            t1.colorMode = 'custom';
          }
        }

        if (panel.grid.threshold2 !== null) {
          t2.value = panel.grid.threshold2;
          if (panel.grid.thresholdLine) {
            t2.line = true;
            t2.lineColor = panel.grid.threshold2Color;
            t2.colorMode = 'custom';
          } else {
            t2.fill = true;
            t2.fillColor = panel.grid.threshold2Color;
            t2.colorMode = 'custom';
          }
        }

        if (isNumber(t1.value)) {
          if (isNumber(t2.value)) {
            if (t1.value > t2.value) {
              t1.op = t2.op = 'lt';
              panel.thresholds.push(t1);
              panel.thresholds.push(t2);
            } else {
              t1.op = t2.op = 'gt';
              panel.thresholds.push(t1);
              panel.thresholds.push(t2);
            }
          } else {
            t1.op = 'gt';
            panel.thresholds.push(t1);
          }
        }

        delete panel.grid.threshold1;
        delete panel.grid.threshold1Color;
        delete panel.grid.threshold2;
        delete panel.grid.threshold2Color;
        delete panel.grid.thresholdLine;

        return panel;
      });
    }

    if (oldVersion < 14) {
      this.dashboard.graphTooltip = old.sharedCrosshair ? 1 : 0;
    }

    if (oldVersion < 16) {
      this.upgradeToGridLayout(old);
    }

    if (oldVersion < 17) {
      panelUpgrades.push((panel: any) => {
        if (panel.minSpan) {
          const max = GRID_COLUMN_COUNT / panel.minSpan;
          const factors = getFactors(GRID_COLUMN_COUNT);
          // find the best match compared to factors
          // (ie. [1,2,3,4,6,12,24] for 24 columns)
          panel.maxPerRow =
            factors[
              findIndex(factors, (o) => {
                return o > max;
              }) - 1
            ];
        }

        delete panel.minSpan;

        return panel;
      });
    }

    if (oldVersion < 18) {
      // migrate change to gauge options
      panelUpgrades.push((panel: any) => {
        if (panel['options-gauge']) {
          panel.options = panel['options-gauge'];
          panel.options.valueOptions = {
            unit: panel.options.unit,
            stat: panel.options.stat,
            decimals: panel.options.decimals,
            prefix: panel.options.prefix,
            suffix: panel.options.suffix,
          };

          // correct order
          if (panel.options.thresholds) {
            panel.options.thresholds.reverse();
          }

          // this options prop was due to a bug
          delete panel.options.options;
          delete panel.options.unit;
          delete panel.options.stat;
          delete panel.options.decimals;
          delete panel.options.prefix;
          delete panel.options.suffix;
          delete panel['options-gauge'];
        }

        return panel;
      });
    }

    if (oldVersion < 19) {
      // migrate change to gauge options
      panelUpgrades.push((panel: any) => {
        if (panel.links && isArray(panel.links)) {
          panel.links = panel.links.map(upgradePanelLink);
        }

        return panel;
      });
    }

    if (oldVersion < 20) {
      const updateLinks = (link: DataLink) => {
        return {
          ...link,
          url: updateVariablesSyntax(link.url),
        };
      };
      panelUpgrades.push((panel: any) => {
        // For graph panel
        if (panel.options && panel.options.dataLinks && isArray(panel.options.dataLinks)) {
          panel.options.dataLinks = panel.options.dataLinks.map(updateLinks);
        }

        // For panel with fieldOptions
        if (panel.options && panel.options.fieldOptions && panel.options.fieldOptions.defaults) {
          if (panel.options.fieldOptions.defaults.links && isArray(panel.options.fieldOptions.defaults.links)) {
            panel.options.fieldOptions.defaults.links = panel.options.fieldOptions.defaults.links.map(updateLinks);
          }
          if (panel.options.fieldOptions.defaults.title) {
            panel.options.fieldOptions.defaults.title = updateVariablesSyntax(
              panel.options.fieldOptions.defaults.title
            );
          }
        }

        return panel;
      });
    }

    if (oldVersion < 21) {
      const updateLinks = (link: DataLink) => {
        return {
          ...link,
          url: link.url.replace(/__series.labels/g, '__field.labels'),
        };
      };
      panelUpgrades.push((panel: any) => {
        // For graph panel
        if (panel.options && panel.options.dataLinks && isArray(panel.options.dataLinks)) {
          panel.options.dataLinks = panel.options.dataLinks.map(updateLinks);
        }

        // For panel with fieldOptions
        if (panel.options && panel.options.fieldOptions && panel.options.fieldOptions.defaults) {
          if (panel.options.fieldOptions.defaults.links && isArray(panel.options.fieldOptions.defaults.links)) {
            panel.options.fieldOptions.defaults.links = panel.options.fieldOptions.defaults.links.map(updateLinks);
          }
        }

        return panel;
      });
    }

    if (oldVersion < 22) {
      panelUpgrades.push((panel: any) => {
        if (panel.type !== 'table') {
          return panel;
        }

        each(panel.styles, (style) => {
          style.align = 'auto';
        });

        return panel;
      });
    }

    if (oldVersion < 23) {
      for (const variable of this.dashboard.templating.list) {
        if (!isMulti(variable)) {
          continue;
        }
        const { multi, current } = variable;
        variable.current = alignCurrentWithMulti(current, multi);
      }
    }

    if (oldVersion < 24) {
      // 7.0
      // - migrate existing tables to 'table-old'
      panelUpgrades.push((panel: any) => {
        const wasAngularTable = panel.type === 'table';
        if (wasAngularTable && !panel.styles) {
          return panel; // styles are missing so assumes default settings
        }
        const wasReactTable = panel.table === 'table2';
        if (!wasAngularTable || wasReactTable) {
          return panel;
        }
        panel.type = wasAngularTable ? 'table-old' : 'table';
        return panel;
      });
    }

    if (oldVersion < 25) {
      // tags are removed in version 28
    }

    if (oldVersion < 26) {
      panelUpgrades.push((panel: any) => {
        const wasReactText = panel.type === 'text2';
        if (!wasReactText) {
          return panel;
        }

        panel.type = 'text';
        delete panel.options.angular;
        return panel;
      });
    }

    if (oldVersion < 27) {
      this.dashboard.templating.list = this.dashboard.templating.list.map((variable) => {
        if (!isConstant(variable)) {
          return variable;
        }

        const newVariable: ConstantVariableModel | TextBoxVariableModel = {
          ...variable,
        };

        newVariable.current = { selected: true, text: newVariable.query ?? '', value: newVariable.query ?? '' };
        newVariable.options = [newVariable.current];

        if (newVariable.hide === VariableHide.dontHide || newVariable.hide === VariableHide.hideLabel) {
          return {
            ...newVariable,
            type: 'textbox',
          };
        }

        return newVariable;
      });
    }

    if (oldVersion < 28) {
      panelUpgrades.push((panel: PanelModel) => {
        if (panel.type === 'singlestat') {
          return migrateSinglestat(panel);
        }

        return panel;
      });

      for (const variable of this.dashboard.templating.list) {
        if (variable.tags) {
          delete variable.tags;
        }

        if (variable.tagsQuery) {
          delete variable.tagsQuery;
        }

        if (variable.tagValuesQuery) {
          delete variable.tagValuesQuery;
        }

        if (variable.useTags) {
          delete variable.useTags;
        }
      }
    }

    if (oldVersion < 29) {
      for (const variable of this.dashboard.templating.list) {
        if (variable.type !== 'query') {
          continue;
        }

        if (variable.refresh !== 1 && variable.refresh !== 2) {
          variable.refresh = 1;
        }

        if (variable.options?.length) {
          variable.options = [];
        }
      }
    }

    if (oldVersion < 30) {
      panelUpgrades.push(upgradeValueMappingsForPanel);
      panelUpgrades.push(migrateTooltipOptions);
    }

    if (oldVersion < 31) {
      panelUpgrades.push((panel: PanelModel) => {
        if (panel.transformations) {
          for (const t of panel.transformations) {
            if (t.id === labelsToFieldsTransformer.id) {
              return appendTransformerAfter(panel, labelsToFieldsTransformer.id, {
                id: mergeTransformer.id,
                options: {},
              });
            }
          }
        }
        return panel;
      });
    }

    if (oldVersion < 32) {
      // CloudWatch migrations have been moved to version 34
    }

    // Replace datasource name with reference, uid and type
    if (oldVersion < 33) {
      panelUpgrades.push((panel) => {
        panel.datasource = migrateDatasourceNameToRef(panel.datasource, { returnDefaultAsNull: true });

        if (!panel.targets) {
          return panel;
        }

        for (const target of panel.targets) {
          const targetRef = migrateDatasourceNameToRef(target.datasource, { returnDefaultAsNull: true });
          if (targetRef != null) {
            target.datasource = targetRef;
          }
        }

        return panel;
      });
    }

    if (oldVersion < 34) {
      panelUpgrades.push((panel: PanelModel) => {
        this.migrateCloudWatchQueries(panel);
        return panel;
      });

      this.migrateCloudWatchAnnotationQuery();
    }

    if (oldVersion < 35) {
      panelUpgrades.push(ensureXAxisVisibility);
    }

    if (oldVersion < 36) {
      // Migrate datasource to refs in annotations
      for (const query of this.dashboard.annotations.list) {
        query.datasource = migrateDatasourceNameToRef(query.datasource, { returnDefaultAsNull: false });
      }

      // Migrate datasource: null to current default
      const defaultDs = getDataSourceSrv().getInstanceSettings(null);
      if (defaultDs) {
        for (const variable of this.dashboard.templating.list) {
          if (variable.type === 'query' && variable.datasource === null) {
            variable.datasource = getDataSourceRef(defaultDs);
          }
        }

        panelUpgrades.push((panel: PanelModel) => {
          if (panel.targets) {
            let panelDataSourceWasDefault = false;
            if (panel.datasource == null && panel.targets.length > 0) {
              panel.datasource = getDataSourceRef(defaultDs);
              panelDataSourceWasDefault = true;
            }

            for (const target of panel.targets) {
              if (target.datasource == null || target.datasource.uid == null) {
                if (panel.datasource?.uid !== MIXED_DATASOURCE_NAME) {
                  target.datasource = { ...panel.datasource };
                } else {
                  target.datasource = migrateDatasourceNameToRef(target.datasource, { returnDefaultAsNull: false });
                }
              }

              if (panelDataSourceWasDefault && target.datasource?.uid !== '__expr__') {
                // We can have situations when default ds changed and the panel level data source is different from the queries
                // In this case we use the query level data source as source for truth
                panel.datasource = target.datasource as DataSourceRef;
              }
            }
          }
          return panel;
        });
      }
    }

    if (oldVersion < 37) {
      panelUpgrades.push((panel: PanelModel) => {
        if (
          panel.options?.legend &&
          // There were two ways to hide the legend, this normalizes to `legend.showLegend`
          (panel.options.legend.displayMode === 'hidden' || panel.options.legend.showLegend === false)
        ) {
          panel.options.legend.displayMode = 'list';
          panel.options.legend.showLegend = false;
        } else if (panel.options?.legend) {
          panel.options.legend = { ...panel.options?.legend, showLegend: true };
        }
        return panel;
      });
    }

    // Update old table cell display configuration to the new
    // format which uses an object for configuration
    if (oldVersion < 38) {
      panelUpgrades.push((panel: PanelModel) => {
        if (panel.type === 'table' && panel.fieldConfig !== undefined) {
          const displayMode = panel.fieldConfig.defaults?.custom?.displayMode;

          // Update field configuration
          if (displayMode !== undefined) {
            // Migrate any options for the panel
            panel.fieldConfig.defaults.custom.cellOptions = migrateTableDisplayModeToCellOptions(displayMode);

            // Delete the legacy field
            delete panel.fieldConfig.defaults.custom.displayMode;
          }

          // Update any overrides referencing the cell display mode
          const overrides = panel.fieldConfig.overrides;
          if (overrides?.length) {
            for (const override of overrides) {
              for (let j = 0; j < override.properties?.length ?? 0; j++) {
                let overrideDisplayMode = override.properties[j].value;
                if (override.properties[j].id === 'custom.displayMode') {
                  override.properties[j].id = 'custom.cellOptions';
                  override.properties[j].value = migrateTableDisplayModeToCellOptions(overrideDisplayMode);
                }
              }
            }
          }
        }

        return panel;
      });
    }

    if (panelUpgrades.length === 0) {
      return;
    }

    for (j = 0; j < this.dashboard.panels.length; j++) {
      for (k = 0; k < panelUpgrades.length; k++) {
        this.dashboard.panels[j] = panelUpgrades[k].call(this, this.dashboard.panels[j]);
        const rowPanels = this.dashboard.panels[j].panels;
        if (rowPanels) {
          for (n = 0; n < rowPanels.length; n++) {
            rowPanels[n] = panelUpgrades[k].call(this, rowPanels[n]);
          }
        }
      }
    }
  }

  // Migrates metric queries and/or annotation queries that use more than one statistic.
  // E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
  // New queries, that were created during migration, are put at the end of the array.
  migrateCloudWatchQueries(panel: PanelModel) {
    for (const target of panel.targets || []) {
      if (isCloudWatchQuery(target)) {
        migrateCloudWatchQuery(target);
        if (target.hasOwnProperty('statistics')) {
          // New queries, that were created during migration, are put at the end of the array.
          const newQueries = migrateMultipleStatsMetricsQuery(target, [...panel.targets]);
          for (const newQuery of newQueries) {
            panel.targets.push(newQuery);
          }
        }
      }
    }
  }

  migrateCloudWatchAnnotationQuery() {
    for (const annotation of this.dashboard.annotations.list) {
      if (isLegacyCloudWatchAnnotationQuery(annotation)) {
        const newAnnotationQueries = migrateMultipleStatsAnnotationQuery(annotation);
        for (const newAnnotationQuery of newAnnotationQueries) {
          this.dashboard.annotations.list.push(newAnnotationQuery);
        }
      }
    }
  }

  upgradeToGridLayout(old: any) {
    let yPos = 0;
    const widthFactor = GRID_COLUMN_COUNT / 12;

    const maxPanelId = max(
      flattenDeep(
        map(old.rows, (row) => {
          return map(row.panels, 'id');
        })
      )
    );
    let nextRowId = maxPanelId + 1;

    if (!old.rows) {
      return;
    }

    // Add special "row" panels if even one row is collapsed, repeated or has visible title
    const showRows = some(old.rows, (row) => row.collapse || row.showTitle || row.repeat);

    for (const row of old.rows) {
      if (row.repeatIteration) {
        continue;
      }

      const height: any = row.height || DEFAULT_ROW_HEIGHT;
      const rowGridHeight = getGridHeight(height);

      const rowPanel: any = {};
      let rowPanelModel: PanelModel | undefined;

      if (showRows) {
        // add special row panel
        rowPanel.id = nextRowId;
        rowPanel.type = 'row';
        rowPanel.title = row.title;
        rowPanel.collapsed = row.collapse;
        rowPanel.repeat = row.repeat;
        rowPanel.panels = [];
        rowPanel.gridPos = {
          x: 0,
          y: yPos,
          w: GRID_COLUMN_COUNT,
          h: rowGridHeight,
        };
        rowPanelModel = new PanelModel(rowPanel);
        nextRowId++;
        yPos++;
      }

      const rowArea = new RowArea(rowGridHeight, GRID_COLUMN_COUNT, yPos);

      for (const panel of row.panels) {
        panel.span = panel.span || DEFAULT_PANEL_SPAN;
        if (panel.minSpan) {
          panel.minSpan = Math.min(GRID_COLUMN_COUNT, (GRID_COLUMN_COUNT / 12) * panel.minSpan);
        }
        const panelWidth = Math.floor(panel.span) * widthFactor;
        const panelHeight = panel.height ? getGridHeight(panel.height) : rowGridHeight;

        const panelPos = rowArea.getPanelPosition(panelHeight, panelWidth);
        yPos = rowArea.yPos;
        panel.gridPos = {
          x: panelPos.x,
          y: yPos + panelPos.y,
          w: panelWidth,
          h: panelHeight,
        };
        rowArea.addPanel(panel.gridPos);

        delete panel.span;

        if (rowPanelModel && rowPanel.collapsed) {
          rowPanelModel.panels?.push(panel);
        } else {
          this.dashboard.panels.push(new PanelModel(panel));
        }
      }

      if (rowPanelModel) {
        this.dashboard.panels.push(rowPanelModel);
      }

      if (!(rowPanelModel && rowPanel.collapsed)) {
        yPos += rowGridHeight;
      }
    }
  }
}

function getGridHeight(height: number | string) {
  if (isString(height)) {
    height = parseInt(height.replace('px', ''), 10);
  }

  if (height < MIN_PANEL_HEIGHT) {
    height = MIN_PANEL_HEIGHT;
  }

  const gridHeight = Math.ceil(height / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN));
  return gridHeight;
}

/**
 * RowArea represents dashboard row filled by panels
 * area is an array of numbers represented filled column's cells like
 *  -----------------------
 * |******** ****
 * |******** ****
 * |********
 *  -----------------------
 *  33333333 2222 00000 ...
 */
class RowArea {
  area: number[];
  yPos: number;
  height: number;

  constructor(height: number, width = GRID_COLUMN_COUNT, rowYPos = 0) {
    this.area = new Array(width).fill(0);
    this.yPos = rowYPos;
    this.height = height;
  }

  reset() {
    this.area.fill(0);
  }

  /**
   * Update area after adding the panel.
   */
  addPanel(gridPos: any) {
    for (let i = gridPos.x; i < gridPos.x + gridPos.w; i++) {
      if (!this.area[i] || gridPos.y + gridPos.h - this.yPos > this.area[i]) {
        this.area[i] = gridPos.y + gridPos.h - this.yPos;
      }
    }
    return this.area;
  }

  /**
   * Calculate position for the new panel in the row.
   */
  getPanelPosition(panelHeight: number, panelWidth: number, callOnce = false): any {
    let startPlace, endPlace;
    let place;
    for (let i = this.area.length - 1; i >= 0; i--) {
      if (this.height - this.area[i] > 0) {
        if (endPlace === undefined) {
          endPlace = i;
        } else {
          if (i < this.area.length - 1 && this.area[i] <= this.area[i + 1]) {
            startPlace = i;
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    if (startPlace !== undefined && endPlace !== undefined && endPlace - startPlace >= panelWidth - 1) {
      const yPos = max(this.area.slice(startPlace));
      place = {
        x: startPlace,
        y: yPos,
      };
    } else if (!callOnce) {
      // wrap to next row
      this.yPos += this.height;
      this.reset();
      return this.getPanelPosition(panelHeight, panelWidth, true);
    } else {
      return null;
    }

    return place;
  }
}

function upgradePanelLink(link: any): DataLink {
  let url = link.url;

  if (!url && link.dashboard) {
    url = `dashboard/db/${kbn.slugifyForUrl(link.dashboard)}`;
  }

  if (!url && link.dashUri) {
    url = `dashboard/${link.dashUri}`;
  }

  // some models are incomplete and have no dashboard or dashUri
  if (!url) {
    url = '/';
  }

  if (link.keepTime) {
    url = urlUtil.appendQueryToUrl(url, `$${DataLinkBuiltInVars.keepTime}`);
  }

  if (link.includeVars) {
    url = urlUtil.appendQueryToUrl(url, `$${DataLinkBuiltInVars.includeVars}`);
  }

  if (link.params) {
    url = urlUtil.appendQueryToUrl(url, link.params);
  }

  return {
    url: url,
    title: link.title,
    targetBlank: link.targetBlank,
  };
}

function updateVariablesSyntax(text: string) {
  const legacyVariableNamesRegex = /(__series_name)|(\$__series_name)|(__value_time)|(__field_name)|(\$__field_name)/g;

  return text.replace(legacyVariableNamesRegex, (match, seriesName, seriesName1, valueTime, fieldName, fieldName1) => {
    if (seriesName) {
      return '__series.name';
    }
    if (seriesName1) {
      return '${__series.name}';
    }
    if (valueTime) {
      return '__value.time';
    }
    if (fieldName) {
      return '__field.name';
    }
    if (fieldName1) {
      return '${__field.name}';
    }
    return match;
  });
}

function migrateSinglestat(panel: PanelModel) {
  // If   'grafana-singlestat-panel' exists, move to that
  if (config.panels['grafana-singlestat-panel']) {
    panel.type = 'grafana-singlestat-panel';
    return panel;
  }

  let returnSaveModel = false;

  if (!panel.changePlugin) {
    returnSaveModel = true;
    panel = new PanelModel(panel);
  }

  // To make sure PanelModel.isAngularPlugin logic thinks the current panel is angular
  // And since this plugin no longer exist we just fake it here
  panel.plugin = { angularPanelCtrl: {} } as PanelPlugin;

  // Otheriwse use gauge or stat panel
  if ((panel as any).gauge?.show) {
    gaugePanelPlugin.meta = config.panels['gauge'];
    panel.changePlugin(gaugePanelPlugin);
  } else {
    statPanelPlugin.meta = config.panels['stat'];
    panel.changePlugin(statPanelPlugin);
  }

  if (returnSaveModel) {
    return panel.getSaveModel();
  }

  return panel;
}

interface MigrateDatasourceNameOptions {
  returnDefaultAsNull: boolean;
}

export function migrateDatasourceNameToRef(
  nameOrRef: string | DataSourceRef | null | undefined,
  options: MigrateDatasourceNameOptions
): DataSourceRef | null {
  if (options.returnDefaultAsNull && (nameOrRef == null || nameOrRef === 'default')) {
    return null;
  }

  if (isDataSourceRef(nameOrRef)) {
    return nameOrRef;
  }

  const ds = getDataSourceSrv().getInstanceSettings(nameOrRef);
  if (!ds) {
    return { uid: nameOrRef as string }; // not found
  }

  return getDataSourceRef(ds);
}

// mutates transformations appending a new transformer after the existing one
function appendTransformerAfter(panel: PanelModel, id: string, cfg: DataTransformerConfig) {
  if (panel.transformations) {
    const transformations: DataTransformerConfig[] = [];
    for (const t of panel.transformations) {
      transformations.push(t);
      if (t.id === id) {
        transformations.push({ ...cfg });
      }
    }
    panel.transformations = transformations;
  }
  return panel;
}

function upgradeValueMappingsForPanel(panel: PanelModel) {
  const fieldConfig = panel.fieldConfig;
  if (!fieldConfig) {
    return panel;
  }

  if (fieldConfig.defaults && fieldConfig.defaults.mappings) {
    fieldConfig.defaults.mappings = upgradeValueMappings(
      fieldConfig.defaults.mappings,
      fieldConfig.defaults.thresholds
    );
  }

  // Protect against no overrides
  if (Array.isArray(fieldConfig.overrides)) {
    for (const override of fieldConfig.overrides) {
      for (const prop of override.properties) {
        if (prop.id === 'mappings') {
          prop.value = upgradeValueMappings(prop.value);
        }
      }
    }
  }

  return panel;
}

function isCloudWatchQuery(target: DataQuery): target is CloudWatchMetricsQuery {
  return (
    target.hasOwnProperty('dimensions') &&
    target.hasOwnProperty('namespace') &&
    target.hasOwnProperty('region') &&
    target.hasOwnProperty('metricName')
  );
}

function isLegacyCloudWatchAnnotationQuery(
  target: AnnotationQuery<DataQuery>
): target is AnnotationQuery<LegacyAnnotationQuery> {
  return (
    target.hasOwnProperty('dimensions') &&
    target.hasOwnProperty('namespace') &&
    target.hasOwnProperty('region') &&
    target.hasOwnProperty('prefixMatching') &&
    target.hasOwnProperty('statistics')
  );
}

function upgradeValueMappings(oldMappings: any, thresholds?: ThresholdsConfig): ValueMapping[] | undefined {
  if (!oldMappings) {
    return undefined;
  }

  const valueMaps: ValueMap = { type: MappingType.ValueToText, options: {} };
  const newMappings: ValueMapping[] = [];

  for (const old of oldMappings) {
    // when migrating singlestat to stat/gauge, mappings are handled by panel type change handler used in that migration
    if (old.type && old.options) {
      // collect al value->text mappings in a single value map object. These are migrated by panel change handler as a separate value maps
      if (old.type === MappingType.ValueToText) {
        valueMaps.options = {
          ...valueMaps.options,
          ...old.options,
        };
      } else {
        newMappings.push(old);
      }
      continue;
    }

    // Use the color we would have picked from thesholds
    let color: string | undefined = undefined;
    const numeric = parseFloat(old.text);
    if (thresholds && !isNaN(numeric)) {
      const level = getActiveThreshold(numeric, thresholds.steps);
      if (level && level.color) {
        color = level.color;
      }
    }

    switch (old.type) {
      case 1: // MappingType.ValueToText:
        if (old.value != null) {
          if (old.value === 'null') {
            newMappings.push({
              type: MappingType.SpecialValue,
              options: {
                match: SpecialValueMatch.Null,
                result: { text: old.text, color },
              },
            });
          } else {
            valueMaps.options[String(old.value)] = {
              text: old.text,
              color,
            };
          }
        }
        break;
      case 2: // MappingType.RangeToText:
        newMappings.push({
          type: MappingType.RangeToText,
          options: {
            from: +old.from,
            to: +old.to,
            result: { text: old.text, color },
          },
        });
        break;
    }
  }

  if (Object.keys(valueMaps.options).length > 0) {
    newMappings.unshift(valueMaps);
  }

  return newMappings;
}

function migrateTooltipOptions(panel: PanelModel) {
  if (panel.type === 'timeseries' || panel.type === 'xychart') {
    if (panel.options.tooltipOptions) {
      panel.options = {
        ...panel.options,
        tooltip: panel.options.tooltipOptions,
      };
      delete panel.options.tooltipOptions;
    }
  }

  return panel;
}

// This migration is performed when there is a time series panel with all axes configured to be hidden
// To avoid breaking dashboards we add override that persists x-axis visibility
function ensureXAxisVisibility(panel: PanelModel) {
  if (panel.type === 'timeseries') {
    if (
      (panel.fieldConfig as FieldConfigSource<GraphFieldConfig>)?.defaults.custom?.axisPlacement ===
      AxisPlacement.Hidden
    ) {
      panel.fieldConfig = {
        ...panel.fieldConfig,
        overrides: [
          ...panel.fieldConfig.overrides,
          {
            matcher: {
              id: FieldMatcherID.byType,
              options: FieldType.time,
            },
            properties: [
              {
                id: 'custom.axisPlacement',
                value: AxisPlacement.Auto,
              },
            ],
          },
        ],
      };
    }
  }

  return panel;
}
