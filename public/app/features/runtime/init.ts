import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';
import { firstValueFrom } from 'rxjs';
import tinycolor from 'tinycolor2';

import { PanelModel as IPanelModel, PanelData, RawTimeRange, toCSV } from '@grafana/data';
import { config } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { getFeatureStatus } from '../dashboard/services/featureFlagSrv';
import { DashboardModel } from '../dashboard/state/DashboardModel';
import { replaceValueForLocale } from '../dashboard/utils/dashboard';
import { PanelMergeInfo } from '../dashboard/utils/panelMerge';

import { PDF } from './pdf';
import { getMultilingualFont } from './pdf/fontUtils';
import { RuntimePDFOptions } from './pdf/types';
import { truncateText } from './pdf/utils';

declare global {
  interface Window {
    grafanaRuntime?: {
      getDashboardSaveModel: () => DashboardModel | undefined;
      getDashboardTimeRange: () => { from: number; to: number; raw: RawTimeRange };
      getPanelData: () => Record<number, PanelData | undefined> | undefined;
      generatePdf: (fileName: string, template: any) => Promise<void>;
      getPanels: () => IPanelModel[] | undefined;
      updatePanels: (panels: IPanelModel[]) => PanelMergeInfo | undefined;
      makePDF: (panelId: number, fileName: string, opt: RuntimePDFOptions) => Promise<void>;
      panelHasData: (panelId: string) => Promise<boolean>;
      makeRecordDetailsResposive: () => void;
    };
  }
}

/**
 * This will setup features that are accessible through the root window location
 *
 * This is useful for manipulating the application from external drivers like puppetter/cypress
 *
 * @internal and subject to change
 */
export function initWindowRuntime() {
  window.grafanaRuntime = {
    /** Get info for the current dashboard.  This will include the migrated dashboard JSON */
    getDashboardSaveModel: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.getSaveModelCloneOld();
    },

    /** The selected time range */
    getDashboardTimeRange: () => {
      const tr = getTimeSrv().timeRange();
      return {
        from: tr.from.valueOf(),
        to: tr.to.valueOf(),
        raw: tr.raw,
      };
    },

    /** Get the query results for the last loaded data */
    getPanelData: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.panels.reduce<Record<number, PanelData | undefined>>((acc, panel) => {
        acc[panel.id] = panel.getQueryRunner().getLastResult();
        return acc;
      }, {});
    },

    getPanels: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      if (!config.bootData.settings.featureToggles.dashboardScene) {
        return d.panels.map((p) => {
          return { ...p, title: p.getDisplayTitle() };
        });
      }
      // @ts-expect-error
      return d.getPanelsForRenderer();
    },

    updatePanels: (panels: IPanelModel[]): PanelMergeInfo | undefined => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.updatePanels(panels);
    },

    makeRecordDetailsResposive: () => {
      const d = getDashboardSrv().getCurrent();
      if (d) {
        // @ts-expect-error
        d.makeRecordDetailsResposive();
      }
    },

    /**
     * This function utilizes JSPDF-Autotable library to generate the PDF mainly for cross tab plugin which will
     * be streamed at the renderrer side after download and then merged with the final output PDF.
     * This code is needed to be here because we can't get HTMLTableElement instance at the renderrer side
     * using pupeteer. For merged colspan and rowspan entries, best way to generate the PDF is using HTMLTableElement
     * instance which is supported by the JSPDF-Autotable library. This function is executed in browser console
     * by renderrer to download the PDF in browser and then reading it like we are reading CSV file.
     *
     * @param fileName - Random fileName of the file to avoid conflicts.
     * @param template - template instance which contains all basic details about header/footer, logo, orientation, theme etc.
     */
    generatePdf: async (fileName: string, template: any) => {
      const urlParams = new URLSearchParams(window.location.search);
      const panelId = urlParams.get('viewPanel') || '0';
      const panel = !config.bootData.settings.featureToggles.dashboardScene
        ? getDashboardSrv().getCurrent()?.getPanelById(Number(panelId))
        : // @ts-expect-error
          getDashboardSrv().getCurrent()?.getPanelByIdForRenderer(panelId);

      const orientation = template.orientation === 'landscape' ? 'l' : 'p';
      const lightTheme = template.theme === 'light';

      if (panel?.type === 'bmc-ade-cross-tab') {
        // - `A3` Paper Size: 11.7in x 16.54in (842.4pt x 1190.88pt) for Simple Layout
        let doc = new jsPDF(orientation, 'pt', [842.4, 1190.88]);
        let margin = 16;
        // Theme instance which contains color codes regardin light and dark theme.
        let theme = {
          fillColor: lightTheme ? '#FFFFFF' : '#181B1F',
          textColor: lightTheme ? '#505050' : '#CCCCDC',
          lineColor: lightTheme ? '#C7C7C7' : '#25272C',
          backGroundFillColor: lightTheme ? '#F4F5F5' : '#0B0C0E',
          tableHeaderFillColor: lightTheme ? '#E0E0E0' : '#181B1F',
          tableHeaderTextColor: lightTheme ? '#000000' : '#CCCCDC',
          headerTextColor: lightTheme ? '#000000' : '#9FA7B3',
          lineDrawColor: lightTheme ? '#000000' : '#2F2F32',
          hyperLinkColor: '#1F62E0',
          headerSectionColor: lightTheme ? '#FFFFFF' : '#0B0C0E',
        };

        const hideDashboardPath = urlParams.get('hideDashboardPath') === 'true';

        // JSPDF-Autotable understands the HTMLTableElement instance to generate the PDF so redirecting
        // renderrer to open the view cross tab panel and finding the instance using the css selector.
        let selector: HTMLTableElement | null = document.querySelector<HTMLTableElement>(
          config.bootData.settings.featureToggles.dashboardScene
            ? "[data-testid='data-testid panel content'] table"
            : '.react-grid-layout table'
        );
        const defaultFontFamily = 'helvetica';
        const panelTitle = config.bootData.settings.featureToggles.dashboardScene
          ? panel.title
          : panel.getDisplayTitle();
        const fontFamily = await getMultilingualFont(doc, [
          selector?.innerText || '',
          template.reportName || '',
          panelTitle || '',
          template.reportDesciption || '',
          template.footerText || '',
          hideDashboardPath ? '' : template.dashboardPath || '',
        ]);
        const currentFontFamily = fontFamily || defaultFontFamily;

        autoTable(doc, {
          html: selector!,
          theme: 'grid',
          styles: {
            fillColor: theme.fillColor,
            textColor: theme.textColor,
            lineColor: theme.lineColor,
          },
          headStyles: {
            fillColor: theme.tableHeaderFillColor,
            textColor: theme.tableHeaderTextColor,
            lineWidth: 1,
          },
          margin: { top: 85, left: margin, right: margin, bottom: 50 },
          startY: 105,
          willDrawPage: (data: any) => {
            // Adding Header to each page - HEADER //
            let fontFamily = currentFontFamily;

            doc.setFillColor(theme.headerSectionColor);
            doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, 'F');
            // Body BackGround Colour

            doc.setFillColor(theme.backGroundFillColor);
            doc.rect(0, 80, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight() - 80, 'F');

            doc.setTextColor(theme.headerTextColor);
            doc.setFontSize(8).setFont(fontFamily, 'bold');
            let pageWidth = doc.internal.pageSize.getWidth();
            const maxWidth = doc.internal.pageSize.getWidth() * 0.7; //70% of pageWidth

            if (!hideDashboardPath) {
              const dashboardPath = truncateText(doc, template.dashboardPath, maxWidth);
              doc.text(dashboardPath, margin, 20);
            }

            if (template.from) {
              doc.setFontSize(8).setFont(defaultFontFamily, 'bold');
              const rangeLabelWidth = doc.getTextWidth('Data time range: ' + template.from) + 15;
              doc.text('Data time range: ', doc.internal.pageSize.getWidth() - rangeLabelWidth, 20);
              const toLabelWidth = doc.getTextWidth('to ' + template.to) + 15;
              doc.text('to ', doc.internal.pageSize.getWidth() - toLabelWidth, 30);
              doc.setFontSize(8).setFont(defaultFontFamily, 'normal');
              // Below 65 is calculated by doc.getTextWidth('Data time range: ') + some margin
              doc.text(template.from, doc.internal.pageSize.getWidth() - rangeLabelWidth + 65, 20);
              // Below 10 is calculated by doc.getTextWidth('to ') + some margin
              doc.text(template.to, doc.internal.pageSize.getWidth() - toLabelWidth + 10, 30);
            }

            doc.setFontSize(12).setFont(fontFamily, 'bold');
            const reportName = truncateText(doc, template.reportName, maxWidth);
            doc.text(reportName, margin, 50);

            if (!!template.description) {
              doc.setFontSize(7).setFont(fontFamily, fontFamily === defaultFontFamily ? 'italic' : 'normal');
              let description = doc.splitTextToSize(template.description, pageWidth - 35, {});
              doc.text(description, margin, 65);
            }
            // Displaying the panel title only on the first page of the pdf for the table panel.
            // Localizing panel title
            let panelTitle = panel.title;
            if (getFeatureStatus('bhd-localization') && !config.bootData.settings.featureToggles.dashboardScene) {
              panelTitle = replaceValueForLocale(panelTitle, panel.locales?.() ?? {});
            }
            if (data.pageNumber === 1) {
              doc.setFontSize(10);
              doc.text(panelTitle, margin, 95);
            }

            const imgProps = doc.getImageProperties(template.companyLogo!);
            const fixedLogoHeight = 32;
            const fixedLogoWidth = (imgProps.width / imgProps.height) * fixedLogoHeight;
            const logoStartXPosition = fixedLogoWidth + 17;
            const logoStartYPosition = 37;
            doc.addImage(
              template.companyLogo!,
              imgProps.fileType,
              doc.internal.pageSize.getWidth() - logoStartXPosition,
              logoStartYPosition,
              fixedLogoWidth,
              fixedLogoHeight
            );

            doc.setDrawColor(theme.lineDrawColor);
            doc.setLineWidth(1.3);
            doc.line(margin, 75, doc.internal.pageSize.getWidth() - margin, 75);
          },
          didDrawPage: (data: any) => {
            // Adding Footer to each page - FOOTER //
            let fontFamily = currentFontFamily;
            doc.setFillColor(theme.headerSectionColor);
            doc.rect(0, doc.internal.pageSize.getHeight() - 30, doc.internal.pageSize.getWidth(), 30, 'F');

            if (!hideDashboardPath) {
              doc.setFontSize(8).setFont(defaultFontFamily, 'bolditalic');
              doc.text('Generated on:', margin, doc.internal.pageSize.getHeight() - 15);
              doc.setFont(defaultFontFamily, 'italic');
              doc.text(template.generatedAt, margin + 57, doc.internal.pageSize.getHeight() - 15);
            }
            doc.setFontSize(8).setFont(fontFamily, fontFamily === defaultFontFamily ? 'bolditalic' : 'bold');

            doc.setTextColor(theme.headerTextColor);
            const xStartingPoint = doc.internal.pageSize.getWidth() - doc.getTextWidth(template.reportFooterText!) - 15;
            doc.text(template.reportFooterText!, xStartingPoint, doc.internal.pageSize.getHeight() - 15);
            doc.link(
              xStartingPoint,
              doc.internal.pageSize.getHeight() - 30,
              doc.getTextWidth(template.reportFooterText!),
              15,
              {
                url: template.reportFooterURL!,
              }
            );
          },
          willDrawCell: function (data: any) {
            let fontFamily = currentFontFamily;
            let computedStyle = getComputedStyle(data.cell.raw);
            // Sometimes getting below mentioned rgb code from the computed style function which is invalid as well.
            if (computedStyle.color && computedStyle.color !== 'rgba(0, 0, 0, 0)') {
              const tinyColor = tinycolor(computedStyle.color);
              if (tinyColor.isValid()) {
                doc.setTextColor(tinyColor.toHexString());
              }
            }
            if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              const tinyColor = tinycolor(computedStyle.backgroundColor);
              if (tinyColor.isValid()) {
                doc.setFillColor(tinyColor.toHexString());
              }
            }

            if (data.cell.section === 'head' && data.cell.raw.nodeName === 'TH') {
              // For head, getting the correct text alignment value in the textAlignLast proeprty.
              if (computedStyle.textAlignLast) {
                data.cell.styles.halign = computedStyle.textAlignLast;
              }
              doc.setFont(fontFamily, 'bold');
            } else {
              // For body, getting the correct text alignment value in the textAlign proeprty.
              if (computedStyle.textAlign) {
                data.cell.styles.halign = computedStyle.textAlign;
              }
              doc.setFont(fontFamily, 'normal');
            }

            let href;
            // If hyperlink is set for TH table nodes then below code is used to set the link for head and body section.
            if (
              data.cell.raw &&
              data.cell.raw.nodeName === 'TH' &&
              data.cell.raw.firstChild &&
              data.cell.raw.firstChild.href
            ) {
              href = data.cell.raw.firstChild.href;
            }

            // Below code is specifically for setting the link for body values only with TD node type.
            // Because we are reading HtmlTableElement so parsing the anchor directly from that and finding
            // the hyperlink cells. This implementation is different then table plugin hyperlink support.
            if (
              !href &&
              data.cell.section === 'body' &&
              data.cell.raw &&
              data.cell.raw.firstChild &&
              data.cell.raw.firstChild.lastChild instanceof HTMLAnchorElement &&
              data.cell.raw.firstChild.lastChild.href
            ) {
              href = data.cell.raw.firstChild.lastChild.href;
            }

            if (href) {
              // Because of variable text size and alignment, it is best and simple to provide the hyperlink to full cell
              // to avoid unnecessary calculation about starting point and ending point of the link cursor box.
              doc.link(data.cell.x, data.cell.y, data.column.width, data.cell.contentHeight, {
                url: href,
              });
            }
          },
        });
        doc.save(fileName, { returnPromise: true });
      }
    },

    makePDF: async (panelId: number | string, fileName: string, opt: RuntimePDFOptions): Promise<any> => {
      const dashboard = getDashboardSrv().getCurrent();
      if (!dashboard) {
        return;
      }
      const panels = !config.bootData.settings.featureToggles.dashboardScene
        ? dashboard.panels
        : // @ts-expect-error
          dashboard.getPanelsForRenderer();
      const panel = panels.find((p: any) => p.id === panelId);
      if (!panel) {
        return;
      }
      const panelTitle = config.bootData.settings.featureToggles.dashboardScene ? panel.title : panel.getDisplayTitle();
      const doc = new PDF({
        orientation: opt.orientation,
        theme: config.theme2.isLight ? 'light' : 'dark',
        table: {
          panelTitle: panelTitle,
          customWidth: opt.customWidth,
          tableScaling: opt.tableScaling,
          recordLimit: opt.recordLimit || 5000,
        },
        brand: {
          companyLogo: opt.companyLogo,
          reportName: opt.reportName,
          reportDescription: opt.reportDescription,
          generatedAt:
            opt.generatedAt ||
            moment().format(config.bootData.settings.dateFormats?.fullDate || 'YYYY-MM-DD HH:mm:ss Z'),
          timeRange: {
            to: opt.timeRange.to,
            from: opt.timeRange.from,
          },
          footerText: opt.footerText,
          footerURL: opt.footerURL,
        },
        dashboardPath: opt.dashboardPath || document.title,
        hideDashboardPath: opt.hideDashboardPath,
        margin: { top: 85, left: 16, right: 16, bottom: 50 },
      });

      if (panel.type === 'table' || panel.type === 'bmc-table-panel') {
        let csvString = '';
        let data: any;
        try {
          if (panel.getQueryRunner) {
            const queryRunner = panel.getQueryRunner();
            if (!queryRunner.getLastResult()) {
              return false;
            }
            data = await firstValueFrom(queryRunner.getData({ withFieldConfig: true, withTransforms: true }));
          } else {
            const scenePanel = (panel as any)._vizPanel;
            const isScenePanel = scenePanel instanceof VizPanel;
            if (isScenePanel) {
              const dataProvider = sceneGraph.getData(scenePanel);
              const providerResult = await firstValueFrom(dataProvider.getResultsStream());
              data = scenePanel.applyFieldConfig(providerResult.data);
            }
          }
          const series = data?.series ?? [];
          csvString = toCSV(series, { useExcelHeader: false, enableOverrides: true, panelId: panel.id });
          if (series.length > 0) {
          }
        } catch (err) {
          console.error('Error fetching panel data:', err);
        }
        await doc.createFromCSV({
          csvContent: csvString,
        });
      }

      if (panel.type === 'bmc-ade-cross-tab') {
        // JSPDF-Autotable understands the HTMLTableElement instance to generate the PDF so redirecting
        // renderrer to open the view cross tab panel and finding the instance using the css selector.
        const selector = config.bootData.settings.featureToggles.dashboardScene
          ? document.querySelector<HTMLTableElement>(`[data-viz-panel-key="${panelId}"] table`)
          : document.querySelector<HTMLTableElement>(`[data-panelid="${panelId}"] table`);

        // handling for multilingual font
        const fontFamily = await getMultilingualFont(doc.doc, [
          selector?.innerText || '',
          opt.reportName || '',
          panelTitle || '',
          opt.reportDescription || '',
          opt.footerText || '',
          opt.hideDashboardPath ? '' : opt.dashboardPath || '',
        ]);
        if (fontFamily) {
          doc.fontFamily = fontFamily;
        }

        await doc.createFromHTML({
          selector: selector ?? undefined,
        });
      }

      if (panel.type === 'bmc-record-details') {
        let elements = config.bootData.settings.featureToggles.dashboardScene
          ? document.querySelectorAll(`[data-viz-panel-key="${panelId}"] .responsive_record_details`)
          : document.querySelectorAll(`[data-panelid="${panelId}"] .responsive_record_details`);
        let isColumn = !panel.options.isDataPositioningStyleDefault;

        let contentJson = [...elements].map((el) => {
          let headerSelector = el.querySelector('h3')!;
          let items = [...el.querySelectorAll('div')];
          let listView = el.querySelector('.list_view_record_details');
          let listViewRows: any[] = [];
          if (listView) {
            let tableRows = listView.querySelectorAll('tr') || undefined;
            if (tableRows) {
              tableRows.forEach((row) => {
                const fieldRow = document.createElement('tr');

                if (row.querySelectorAll('th').length) {
                  const [column1, column2] = row.querySelectorAll('th');
                  fieldRow.append(column1);
                  fieldRow.append(column2);
                }
                if (row.querySelectorAll('td').length) {
                  const [column1, column2] = row.querySelectorAll('td');
                  const fieldCell = document.createElement('td');

                  fieldCell.innerHTML = (column1.textContent ?? '').replaceAll('\n', '<br>');
                  fieldCell.style.color = column1.style.color;
                  fieldCell.style.backgroundColor = column1.style.backgroundColor;
                  fieldCell.style.whiteSpace = 'break-spaces';
                  fieldRow.append(fieldCell);

                  const fieldCell2 = document.createElement('td');
                  fieldCell2.innerHTML = (column2.textContent ?? '').replaceAll('\n', '<br>');
                  fieldCell2.style.color = column2.style.color;
                  fieldCell2.style.backgroundColor = column2.style.backgroundColor;
                  fieldCell2.style.whiteSpace = 'break-spaces';
                  fieldRow.append(fieldCell2);
                }
                listViewRows.push(fieldRow);
              });
            }
          }
          return {
            header: {
              listView: listView ? true : false,
              listViewRows: listViewRows,
              text: headerSelector?.textContent,
              color: window.getComputedStyle(headerSelector)?.color,
              background: window.getComputedStyle(headerSelector)?.backgroundColor,
            },
            items: items.map((item) => {
              let spans = item.querySelectorAll('span');
              let anchors = item.querySelectorAll('a');

              if (spans.length === 0) {
                return {
                  field: {
                    text: item.textContent,
                    color: window.getComputedStyle(item)?.color,
                    background: window.getComputedStyle(item)?.backgroundColor,
                  },
                  value: {
                    text: '',
                    color: '',
                    background: '',
                  },
                };
              }

              let fieldStyle = window.getComputedStyle(spans[0]);

              if (spans.length === 1 && anchors.length > 0) {
                let anchor = anchors[0];
                let valueStyle = window.getComputedStyle(anchor);
                return {
                  field: {
                    text: spans[0].textContent,
                    color: fieldStyle?.color,
                    background: fieldStyle?.backgroundColor,
                  },
                  value: {
                    text: (anchor.textContent ?? '').replaceAll('\n', '<br>'),
                    url: anchor.href,
                    color: valueStyle?.color,
                    background: valueStyle?.backgroundColor,
                  },
                };
              }

              let valueStyle = window.getComputedStyle(spans[1]);
              return {
                field: {
                  text: spans[0].textContent,
                  color: fieldStyle.color,
                  background: fieldStyle.backgroundColor,
                },
                value: {
                  text: (spans[1].textContent ?? '').replaceAll('\n', '<br>'),
                  color: valueStyle.color,
                  background: valueStyle.backgroundColor,
                },
              };
            }),
          };
        });

        // Create table dynamically
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = 'Open Sans, sans-serif';

        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        document.body.appendChild(table);

        contentJson.forEach((entry, i) => {
          if (i !== 0) {
            // Add an empty row before the header
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.setAttribute('colspan', isColumn ? '1' : '2');
            emptyCell.style.height = '10px'; // Add some space
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
          }

          if (!!entry.header.text) {
            const headerRow = document.createElement('tr');
            const headerCell = document.createElement('th');
            headerCell.textContent = entry.header.text;
            headerCell.style.color = entry.header.color;
            headerCell.style.backgroundColor = entry.header.background;
            headerCell.style.textAlign = 'left';
            headerCell.setAttribute('colspan', isColumn ? '1' : '2');
            headerRow.appendChild(headerCell);
            tbody.appendChild(headerRow);
          }

          if (entry.header.listView && entry.header.listViewRows) {
            entry.header.listViewRows.forEach((elm) => {
              tbody.appendChild(elm);
            });
          } else {
            entry.items.forEach((item) => {
              if (isColumn) {
                // Separate field and value into different rows
                const fieldRow = document.createElement('tr');
                const fieldCell = document.createElement('td');
                fieldCell.textContent = item.field.text;
                fieldCell.style.color = item.field.color;
                fieldCell.style.backgroundColor = item.field.background;
                fieldCell.style.fontWeight = 'bold';
                fieldRow.appendChild(fieldCell);
                tbody.appendChild(fieldRow);

                const valueRow = document.createElement('tr');
                const valueCell = document.createElement('td');

                valueCell.style.backgroundColor = item.value.background;
                valueCell.style.color = item.value.color;
                valueCell.style.whiteSpace = 'break-spaces';

                if (item.value.url) {
                  let link = document.createElement('a');
                  link.href = item.value.url;
                  link.textContent = item.value.text;
                  link.style.color = item.value.color;
                  link.style.backgroundColor = item.value.background;
                  valueCell.appendChild(link);
                } else {
                  valueCell.innerHTML = item.value.text ?? '';
                }

                valueRow.appendChild(valueCell);
                tbody.appendChild(valueRow);
              } else {
                // Two-column layout
                const row = document.createElement('tr');
                const fieldCell = document.createElement('td');
                fieldCell.textContent = item.field.text;
                fieldCell.style.color = item.field.color;
                fieldCell.style.backgroundColor = item.field.background;
                fieldCell.style.fontWeight = 'bold';
                row.appendChild(fieldCell);

                const valueCell = document.createElement('td');
                valueCell.style.backgroundColor = item.value.background;
                valueCell.style.color = item.value.color;
                valueCell.style.whiteSpace = 'break-spaces';

                if (item.value.url) {
                  let link = document.createElement('a');
                  link.href = item.value.url;
                  link.textContent = item.value.text;
                  link.style.color = item.value.color;
                  link.style.backgroundColor = item.value.background;
                  link.style.textDecoration = 'none';
                  valueCell.appendChild(link);
                } else {
                  valueCell.innerHTML = item.value.text ?? '';
                }
                row.appendChild(valueCell);

                tbody.appendChild(row);
              }
            });
          }
        });

        const widthPercentage = panel.options.isBgColorDefault ? 25 : panel.options.widthPercent;
        // handling for multilingual font
        const fontFamily = await getMultilingualFont(doc.doc, [
          table?.innerText || '',
          opt.reportName || '',
          panelTitle || '',
          opt.reportDescription || '',
          opt.footerText || '',
          opt.hideDashboardPath ? '' : opt.dashboardPath || '',
        ]);

        if (fontFamily) {
          doc.fontFamily = fontFamily;
        }

        await doc.createFromHTML({
          selector: table,
          theme: 'plain',
          useCss: false,
          firstColumnWidth: isColumn ? undefined : widthPercentage,
        });
        table.remove();
      }

      await doc.saveAs(fileName);
    },
    panelHasData: async (panelId: string): Promise<boolean> => {
      const dashboard = getDashboardSrv().getCurrent();
      if (!dashboard) {
        return false;
      }
      const panelIdNum = !config.bootData.settings.featureToggles.dashboardScene ? Number(panelId) : panelId;
      const panels = !config.bootData.settings.featureToggles.dashboardScene
        ? dashboard.panels
        : // @ts-expect-error
          dashboard.getPanelsForRenderer();
      const panel = panels.find((p: any) => p.id === panelIdNum);
      if (!panel) {
        return false;
      }

      let data: PanelData | undefined = undefined;

      try {
        // Handle standard dashboard panels
        if (panel.getQueryRunner) {
          const queryRunner = panel.getQueryRunner();
          if (!queryRunner.getLastResult()) {
            return false;
          }

          data = await firstValueFrom(queryRunner.getData({ withFieldConfig: true, withTransforms: true }));
        } else {
          const scenePanel = (panel as any)._vizPanel;
          const isScenePanel = scenePanel instanceof VizPanel;
          if (isScenePanel) {
            const dataProvider = sceneGraph.getData(scenePanel);
            const providerResult = await firstValueFrom(dataProvider.getResultsStream());
            data = scenePanel.applyFieldConfig(providerResult.data);
          }
        }
        const state = data?.state ?? [];
        const series = data?.series ?? [];
        if (state === 'Error') {
          return true;
        }
        if (series && series.length >= 1) {
          for (const seriesItem of series) {
            const fields = seriesItem.fields;
            if (fields && fields.length > 0) {
              for (const field of fields) {
                const values = field.values;
                if (values.length > 0) {
                  return true;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Error in panelHasData for panelId:', panelId, err);
      }

      return false;
    },
  };
}
