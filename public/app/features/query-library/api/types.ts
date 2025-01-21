// pkg/apis/iam/v0alpha1/types_display.go
export type UserDataQueryResponse = {
  apiVersion: string;
  kind: string;
  metadata: {
    selfLink: string;
    resourceVersion: string;
    continue: string;
    remainingItemCount: number;
  };
  display: UserSpecResponse[];
  keys: string[];
};

// pkg/apis/iam/v0alpha1/types_display.go
export type UserSpecResponse = {
  avatarUrl: string;
  displayName: string;
  identity: {
    name: string;
    type: string;
  };
  internalId: number;
};

export const CREATED_BY_KEY = 'grafana.app/createdBy';
