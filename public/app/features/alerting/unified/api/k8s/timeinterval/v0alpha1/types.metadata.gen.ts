/**
 * metadata contains embedded CommonMetadata and can be extended with custom string fields
 * TODO: use CommonMetadata instead of redefining here; currently needs to be defined here
 * without external reference as using the CommonMetadata reference breaks thema codegen.
 */
export interface Metadata {
  createdBy: string;
  creationTimestamp: string;
  deletionTimestamp?: string;
  finalizers: string[];
  generation: number;
  labels: Record<string, string>;
  resourceVersion: string;
  uid: string;
  updateTimestamp: string;
  updatedBy: string;
}

export const defaultMetadata: Partial<Metadata> = {
  finalizers: [],
};
