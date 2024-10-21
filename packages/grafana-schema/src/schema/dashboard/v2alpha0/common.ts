// Already available as Resource in /public/app/features/apiserver/types.ts, need to re-use it
export interface Kind<K extends string, S, M = {}> {
  kind: K;
  metadata?: M;
  spec: S;
}

export type Reference = {
  $ref: string;
};

export type Referenceable<T> = Record<string, T>;
