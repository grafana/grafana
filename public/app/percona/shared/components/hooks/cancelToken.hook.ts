import axios, { CancelTokenSource } from 'axios';
import { useRef, useEffect, useCallback } from 'react';

export const useCancelToken = () => {
  const tokens = useRef<Record<string, CancelTokenSource>>({});

  const cancelToken = useCallback((sourceName: string) => {
    tokens.current[sourceName] && tokens.current[sourceName].cancel();
  }, []);

  const generateToken = useCallback(
    (sourceName: string) => {
      cancelToken(sourceName);
      const tokenSource = axios.CancelToken.source();
      tokens.current = { ...tokens.current, [sourceName]: tokenSource };
      return tokenSource.token;
    },
    [cancelToken]
  );

  useEffect(
    () => () => {
      Object.keys(tokens.current).forEach((sourceName) => {
        cancelToken(sourceName);
      });
    },
    [cancelToken]
  );

  return [generateToken, cancelToken] as const;
};
