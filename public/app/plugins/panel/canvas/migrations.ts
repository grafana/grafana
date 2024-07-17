import { DataLink, DynamicConfigValue, FieldMatcherID, PanelModel } from '@grafana/data';
import { CanvasElementOptions } from 'app/features/canvas/element';

import { Options } from './panelcfg.gen';

export const canvasMigrationHandler = (panel: PanelModel): Partial<Options> => {
  const pluginVersion = panel?.pluginVersion ?? '';

  // Rename text-box to rectangle
  // Initial plugin version is empty string for first migration
  if (pluginVersion === '') {
    const root = panel.options?.root;
    if (root?.elements) {
      for (const element of root.elements) {
        if (element.type === 'text-box') {
          element.type = 'rectangle';
        }
      }
    }
  }

  if (pluginVersion.startsWith('11.0')) {
    // Migration for v11.0 for ellipse element refactor: https://github.com/grafana/grafana/pull/84205
    const root = panel.options?.root;
    if (root?.elements) {
      for (const element of root.elements) {
        if (element.type === 'ellipse') {
          // Take existing ellipse specific background and border config and apply it to the element's general background and border config
          if (element.config.backgroundColor) {
            element.background = element.config.backgroundColor;
            delete element.config.backgroundColor;
          }
          if (element.config.borderColor) {
            element.border.color = element.config.borderColor;
            delete element.config.borderColor;
          }
          if (element.config.width) {
            element.border.width = element.config.width;
            delete element.config.width;
          }
        }
      }
    }
  }

  if (parseFloat(pluginVersion) <= 11.2) {
    for (let idx = 0; idx < panel.fieldConfig.overrides.length; idx++) {
      const override = panel.fieldConfig.overrides[idx];

      if (override.matcher.id === FieldMatcherID.byName) {
        let props: DynamicConfigValue[] = [];

        // append override links to elements with dimensions mapped to same field name
        for (const prop of override.properties) {
          if (prop.id === 'links') {
            addLinks(panel.options.root.elements, prop.value, override.matcher.options);
          } else {
            props.push(prop);
          }
        }

        if (props.length > 0) {
          override.properties = props;
        } else {
          panel.fieldConfig.overrides.splice(idx, 1);
        }
      }
    }
  }

  return panel.options;
};

function addLinks(elements: CanvasElementOptions[], links: DataLink[], fieldName?: string) {
  const varsNamesRegex = /(\${__field.name})|(\${__field.labels.*?})|(\${__series.name})/g;

  const linksCopy = [...links];
  linksCopy.forEach((link) => {
    const isFieldOrSeries = varsNamesRegex.test(link.url);
    if (isFieldOrSeries) {
      link.url = link.url.replace(varsNamesRegex, (match, fieldName1, fieldLabels1, seriesName1) => {
        if (fieldName1 || seriesName1) {
          return '${__data.fields["' + fieldName + '"]}';
        }

        if (fieldLabels1) {
          const labels = fieldLabels1.match(new RegExp('.labels' + '(.*)' + '}'));
          return '${__data.fields["' + fieldName + '"].labels' + labels[1] + '}';
        }

        return match;
      });
    }
  });

  elements.forEach((element) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cfg: Record<string, any> = element.config;

    for (let k in cfg) {
      let dim = cfg[k];

      // todo: getFieldDisplayName?
      if (dim.field === fieldName) {
        element.links ??= [];
        element.links.push(...linksCopy);
      }
    }
  });
}
