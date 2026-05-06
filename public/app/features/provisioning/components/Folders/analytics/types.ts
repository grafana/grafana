import { type EventProperty } from '@grafana/runtime/internal';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

type RepoType = RepositoryView['type'];

export interface ReadmePanelViewedProperties extends EventProperty {
  /** Host repository type for the folder being viewed. */
  repositoryType: RepoType;
  /** Lifecycle state the panel rendered in: README rendered (`ok`), absent (`missing`), or load failure (`error`). */
  status: 'ok' | 'missing' | 'error';
}

export interface ReadmeEditClickedProperties extends EventProperty {
  /** Host repository type for the folder whose README is being edited. */
  repositoryType: RepoType;
}

export interface ReadmeCreateClickedProperties extends EventProperty {
  /** Host repository type for the folder where a README is being authored. */
  repositoryType: RepoType;
}

export interface ReadmeLinkClickedProperties extends EventProperty {
  /** Host repository type for the folder whose rendered README contains the clicked link. */
  repositoryType: RepoType;
}

export interface ReadmeRetryClickedProperties extends EventProperty {
  /** Host repository type for the folder whose README load is being retried. */
  repositoryType: RepoType;
}
