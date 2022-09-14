import saveAs from 'file-saver';

import { dateTimeFormat, formattedValueToString, getValueFormat, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { getTimeSrv } from '../../services/TimeSrv';
import { PanelModel } from '../../state';
import { setDashboardToFetchFromLocalStorage } from '../../state/initDashboard';

import { Randomize } from './randomizer';
import { getDebugDashboard, getGithubMarkdown } from './utils';

interface SupportSnapshotState {
  currentTab: SnapshotTab;
  showMessage: ShowMessage;
  options: Array<SelectableValue<ShowMessage>>;
  snapshotText: string;
  markdownText: string;
  snapshotSize?: string;
  randomize: Randomize;
  iframeLoading?: boolean;
  loading?: boolean;
  error?: {
    title: string;
    message: string;
  };
  panel: PanelModel;
  panelTitle: string;
  snapshot?: any;
}

export enum SnapshotTab {
  Support,
  Data,
}

export enum ShowMessage {
  PanelSnapshot = 'snap',
  GithubComment = 'github',
}

export class SupportSnapshotService extends StateManagerBase<SupportSnapshotState> {
  constructor(panel: PanelModel) {
    super({
      panel,
      panelTitle: panel.replaceVariables(panel.title, undefined, 'text') || 'Panel',
      currentTab: SnapshotTab.Support,
      showMessage: ShowMessage.GithubComment,
      snapshotText: '',
      markdownText: '',
      randomize: {},
      options: [
        {
          label: 'Github comment',
          description: 'Copy and paste this message into a github issue or comment',
          value: ShowMessage.GithubComment,
        },
        {
          label: 'Panel support snapshot',
          description: 'Dashboard JSON used to help troubleshoot visualization issues',
          value: ShowMessage.PanelSnapshot,
        },
      ],
    });
  }

  async buildDebugDashboard() {
    const { panel, randomize } = this.state;
    const snapshot = await getDebugDashboard(panel, randomize, getTimeSrv().timeRange());
    const snapshotText = JSON.stringify(snapshot, null, 2);
    const markdownText = getGithubMarkdown(panel, snapshotText);
    const snapshotSize = formattedValueToString(getValueFormat('bytes')(snapshotText?.length ?? 0));

    this.setState({ snapshot, snapshotText, markdownText, snapshotSize });
  }

  onCurrentTabChange = (value: SnapshotTab) => {
    this.setState({ currentTab: value });
  };

  onShowMessageChange = (value: SelectableValue<ShowMessage>) => {
    this.setState({ showMessage: value.value! });
  };

  onGetMarkdownForClipboard = () => {
    const { markdownText } = this.state;
    const maxLen = Math.pow(1024, 2) * 1.5; // 1.5MB

    if (markdownText.length > maxLen) {
      this.setState({
        error: {
          title: 'Copy to clipboard failed',
          message: 'Snapshot is too large, consider download and attaching a file instead',
        },
      });

      return '';
    }

    return markdownText;
  };

  onDownloadDashboard = () => {
    const { snapshotText, panelTitle } = this.state;
    const blob = new Blob([snapshotText], {
      type: 'text/plain',
    });
    const fileName = `debug-${panelTitle}-${dateTimeFormat(new Date())}.json.txt`;
    saveAs(blob, fileName);
  };

  onSetSnapshotText = (snapshotText: string) => {
    this.setState({ snapshotText });
  };

  onToggleRandomize = (k: keyof Randomize) => {
    const { randomize } = this.state;
    this.setState({ randomize: { ...randomize, [k]: !randomize[k] } });
  };

  onPreviewDashboard = () => {
    const { snapshot } = this.state;
    if (snapshot) {
      setDashboardToFetchFromLocalStorage({ meta: {}, dashboard: snapshot });
      global.open(config.appUrl + 'dashboard/new', '_blank');
    }
  };

  subscribeToIframeLoadingMessage() {
    console.log('subscribeToIframeLoadingMessage');
    const handleEvent = (evt: MessageEvent<string>) => {
      if (evt.data === 'GrafanaAppInit') {
        setDashboardToFetchFromLocalStorage({ meta: {}, dashboard: this.state.snapshot });
        this.setState({ iframeLoading: true });
      }
    };
    window.addEventListener('message', handleEvent, false);

    return function cleanup() {
      console.log('unsub');
      window.removeEventListener('message', handleEvent);
    };
  }
}
