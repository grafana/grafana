import { RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';

import { AuthTypeStep } from '../AuthTypeStep';
import { BootstrapStep } from '../BootstrapStep';
import { ConnectStep } from '../ConnectStep';
import { FinishStep } from '../FinishStep';
import { SynchronizeStep } from '../SynchronizeStep';
import { ConnectionCreationResult, WizardStep } from '../types';

export interface WizardStepContentProps {
  activeStep: WizardStep;
  settingsData?: RepositoryViewList;
  repoName: string;
  onGitHubAppSubmit: (result: ConnectionCreationResult) => void;
  onRepositoryDeletion: (name: string) => Promise<void>;
  isCancelling: boolean;
  goToStep: (stepId: WizardStep) => void;
}

export function WizardStepContent({
  activeStep,
  settingsData,
  repoName,
  onGitHubAppSubmit,
  onRepositoryDeletion,
  isCancelling,
  goToStep,
}: WizardStepContentProps) {
  switch (activeStep) {
    case 'authType':
      return <AuthTypeStep onGitHubAppSubmit={onGitHubAppSubmit} />;
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
