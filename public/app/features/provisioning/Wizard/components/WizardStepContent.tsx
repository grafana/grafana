import { type RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';

import { AuthTypeStep } from '../AuthTypeStep';
import { BootstrapStep } from '../BootstrapStep';
import { ConnectStep } from '../ConnectStep';
import { FinishStep } from '../FinishStep';
import { SourceConnectStep } from '../SourceConnectStep';
import { SynchronizeStep } from '../SynchronizeStep';
import { type ConnectionCreationResult, type RepoType, type WizardStep } from '../types';

export interface WizardStepContentProps {
  activeStep: WizardStep;
  repoType: RepoType;
  settingsData?: RepositoryViewList;
  repoName: string;
  onGitHubAppSubmit: (result: ConnectionCreationResult) => void;
  onRepositoryDeletion: (name: string) => Promise<void>;
  isCancelling: boolean;
  goToStep: (stepId: WizardStep) => void;
}

export function WizardStepContent({
  activeStep,
  repoType,
  settingsData,
  repoName,
  onGitHubAppSubmit,
  onRepositoryDeletion,
  isCancelling,
  goToStep,
}: WizardStepContentProps) {
  switch (activeStep) {
    case 'authType':
      return repoType === 'source' ? <SourceConnectStep /> : <AuthTypeStep onGitHubAppSubmit={onGitHubAppSubmit} />;
    case 'connection':
      return <ConnectStep />;
    case 'bootstrap':
      return <BootstrapStep settingsData={settingsData} repoName={repoName} />;
    case 'synchronize':
      return <SynchronizeStep onCancel={onRepositoryDeletion} isCancelling={isCancelling} goToStep={goToStep} />;
    case 'finish':
      return <FinishStep />;
    default:
      return null;
  }
}
