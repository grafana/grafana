export type SystemJSLoad = {
  address: string;
  metadata: {
    authorization: boolean;
    cjsDeferDepsExecute: boolean;
    cjsRequireDetection: boolean;
    crossOrigin?: boolean;
    encapsulateGlobal: boolean;
    esModule: boolean;
    integrity?: string;
    loader: string;
    scriptLoad?: boolean;
  };
  name: string;
  source: string;
};
