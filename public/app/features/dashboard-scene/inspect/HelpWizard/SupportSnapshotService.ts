import saveAs from 'file-saver';

import { dateTimeFormat, formattedValueToString, getValueFormat, SelectableValue } from '@grafana/data';
import { sceneGraph, SceneObject, VizPanel } from '@grafana/scenes';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';

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
  loading?: boolean;
  error?: {
    title: string;
    message: string;
  };
  panel: VizPanel;
  panelTitle: string;

  // eslint-disable-next-line
  snapshot?: any;
  snapshotUpdate: number;
  scene?: SceneObject;
}

export enum SnapshotTab {
  Support,
  Data,
}

export enum ShowMessage {
  PanelSnapshot,
  GithubComment,
}

export class SupportSnapshotService extends StateManagerBase<SupportSnapshotState> {
  constructor(panel: VizPanel) {
    super({
      panel,
      panelTitle: sceneGraph.interpolate(panel, panel.state.title, {}, 'text'),
      currentTab: SnapshotTab.Support,
      showMessage: ShowMessage.GithubComment,
      snapshotText: '',
      markdownText: '',
      randomize: {},
      snapshotUpdate: 0,
      options: [
        {
          label: 'GitHub comment',
          description: 'Copy and paste this message into a GitHub issue or comment',
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
    const { panel, randomize, snapshotUpdate } = this.state;
    const snapshot = await getDebugDashboard(panel, randomize, sceneGraph.getTimeRange(panel).state.value);
    const snapshotText = JSON.stringify(snapshot, null, 2);
    const markdownText = getGithubMarkdown(panel, snapshotText);
    const snapshotSize = formattedValueToString(getValueFormat('bytes')(snapshotText?.length ?? 0));

    let scene: SceneObject | undefined = undefined;
    if (snapshot) {
      try {
        const dash = transformSaveModelToScene({ dashboard: snapshot, meta: { isEmbedded: true } });
        scene = dash.state.body; // skip the wrappers
      } catch (ex) {
        console.log('Error creating scene:', ex);
      }
    }

    this.setState({ snapshot, snapshotText, markdownText, snapshotSize, snapshotUpdate: snapshotUpdate + 1, scene });
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
}
