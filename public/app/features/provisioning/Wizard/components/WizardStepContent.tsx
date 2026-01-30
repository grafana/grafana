import { RefObject } from 'react';

import { RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';

import { AuthTypeStep } from '../AuthTypeStep';
import { BootstrapStep } from '../BootstrapStep';
import { ConnectStep } from '../ConnectStep';
import { FinishStep } from '../FinishStep';
import { GitHubAppStep, GitHubAppStepRef } from '../GitHubAppStep';
import { SynchronizeStep } from '../SynchronizeStep';
import { ConnectionCreationResult, WizardStep } from '../types';

export interface WizardStepContentProps {
  activeStep: WizardStep;
  settingsData?: RepositoryViewList;
  repoName: string;
  githubAppStepRef: RefObject<GitHubAppStepRef | null>;
  onGitHubAppSubmit: (result: ConnectionCreationResult) => void;
  onRepositoryDeletion: (name: string) => Promise<void>;
  isCancelling: boolean;
}

export function WizardStepContent({
  activeStep,
  settingsData,
  repoName,
  githubAppStepRef,
  onGitHubAppSubmit,
  onRepositoryDeletion,
  isCancelling,
}: WizardStepContentProps) {
  switch (activeStep) {
    case 'authType':
      return <AuthTypeStep />;
    case 'githubApp':
      return <GitHubAppStep ref={githubAppStepRef} onSubmit={onGitHubAppSubmit} />;
    case 'connection':
      return <ConnectStep />;
    case 'bootstrap':
      return <BootstrapStep settingsData={settingsData} repoName={repoName} />;
    case 'synchronize':
      return <SynchronizeStep onCancel={onRepositoryDeletion} isCancelling={isCancelling} />;
    case 'finish':
      return <FinishStep />;
    default:
      return null;
  }
}
