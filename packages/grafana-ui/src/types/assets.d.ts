declare module '*.mdx' {
  const content: unknown;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare global {
  interface Window {
    __grafana_public_path__: string;
  }
}
