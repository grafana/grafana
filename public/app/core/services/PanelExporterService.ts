import {
  // CoreApp,
  CSVConfig,
  DataFrame,
  DataTransformerID,
  //  PanelModel,
  //  TimeZone,
} from '@grafana/data';
import appEvents from 'app/core/app_events';
import { downloadDataFrameAsCsv } from 'app/features/inspector/utils/download';
//import { GetDataOptions } from 'app/features/query/state/PanelQueryRunner';
//import { PureComponent } from 'react';

import { ExportPanelPayload, PanelExportEvent } from '../../types/events';

/*interface Props {
    isLoading: boolean;
    options: GetDataOptions;
    timeZone: TimeZone;
    app?: CoreApp;
    data?: DataFrame[];
    panel?: PanelModel;
    onOptionsChange?: (options: GetDataOptions) => void;
  }
  
  interface State {
    selectedDataFrame: number | DataTransformerID;
    transformId: DataTransformerID;
    dataFrameIndex: number;
  //  transformationOptions: Array<SelectableValue<DataTransformerID>>;
    transformedData: DataFrame[];
    downloadForExcel: boolean;
  } */

export class PanelExporterService {
  init() {
    // right now holding no type
    console.log('WOW'); // NOT REACHING INIT
    appEvents.subscribe(PanelExportEvent, (e) => {
      console.log('the e', e);
      this.exportPNG(e.payload);
    }); // Binds PanelExportEvent to exportPNG method
  }

  exportSelector(e: ExportPanelPayload) {
    switch (
      e.exportType
      //...
    ) {
    }
  }

  exportPNG(e: ExportPanelPayload) {
    console.log('exportPNG', e);
    //todo avoid as     DONE?
    const canvas = e.htmlElement;

    //TODO FIX
    const link = document.createElement('a');
    link.download = 'asdasd.png'; // Do we want custom names or nah?
    canvas.toBlob((blob) => {
      link.href = URL.createObjectURL(blob!);
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  }

  exportCsv = (dataFrame: DataFrame, csvConfig: CSVConfig = {}) => {
    // const { panel } = this.props;
    const transformId = DataTransformerID.noop;

    downloadDataFrameAsCsv(dataFrame, 'OHNO', csvConfig, transformId);
  }; // FROM InspectDataTab.tsx
  // [ download.ts ALSO HAS DownloadAsJson() ]

  /*
    onClick={() => {
                if (hasLogs) {
                  reportInteraction('grafana_logs_download_clicked', {
                    app,
                    format: 'csv',
                  });
                }
                this.exportCsv(dataFrames[dataFrameIndex], { useExcelHeader: this.state.downloadForExcel });
              }}
              */
}
