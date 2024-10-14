export interface Kind<K extends string, S extends Object, M = {}> {
  kind: K;
  metadata?: M;
  spec: S;
}

export type Reference = {
  $ref: string;
};
