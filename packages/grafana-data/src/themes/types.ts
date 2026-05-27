/** @internal */
export type DeepRequired<T> = Required<{
  [P in keyof T]: T[P] extends Required<T[P]> ? T[P] : DeepRequired<T[P]>;
}>;
