export interface StreamOptions {
  path: string;
  subscribe: boolean;
}

export const defaults: StreamOptions = {
  path: '',
  subscribe: false,
};
