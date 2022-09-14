import { SelectableValue } from '@grafana/data';
import { SceneObjectBase } from 'app/features/scenes/core/SceneObjectBase';
import { SceneObjectStatePlain } from 'app/features/scenes/core/types';

import { Randomize } from './randomizer';

interface SupportSnapshotState extends SceneObjectStatePlain {
  currentTab: SnapshotTab;
  showMessage: ShowMessage;
  options: Array<SelectableValue<ShowMessage>>;
  snapshotText: string;
  markdownText: string;
  snapshotSize?: number;
  randomize: Randomize;
  iframeLoading?: boolean;
  loading?: boolean;
  error?: Error;
}

export enum SnapshotTab {
  Support,
  Data,
}

export enum ShowMessage {
  PanelSnapshot = 'snap',
  GithubComment = 'github',
}

export class SupportSnapshotService extends SceneObjectBase<SupportSnapshotState> {
  constructor() {
    super({
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

  onCurrentTabChange = (value: SnapshotTab) => {
    this.setState({ currentTab: value });
  };

  onShowMessageChange = (value: SelectableValue<ShowMessage>) => {
    this.setState({ showMessage: value.value! });
  };

  onCopyMarkdown = () => {};

  onDownloadDashboard = () => {};

  onSetSnapshotText = (snapshotText: string) => {
    this.setState({ snapshotText });
  };

  onToggleRandomize = (k: keyof Randomize) => {
    const { randomize } = this.state;
    this.setState({ randomize: { ...randomize, [k]: !randomize[k] } });
  };

  onPreviewDashboard = () => {};
}
