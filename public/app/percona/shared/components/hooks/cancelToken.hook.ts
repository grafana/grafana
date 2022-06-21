import axios, { CancelTokenSource } from 'axios';
import { useRef, useEffect } from 'react';

export const useCancelToken = () => {
  const tokens = useRef<Record<string, CancelTokenSource>>({});

  const cancelToken = (sourceName: string) => {
    tokens.current[sourceName] && tokens.current[sourceName].cancel();
  };

  const generateToken = (sourceName: string) => {
    cancelToken(sourceName);
    const tokenSource = axios.CancelToken.source();
    tokens.current = { ...tokens.current, [sourceName]: tokenSource };
    return tokenSource.token;
  };

  useEffect(
    () => () => {
      Object.keys(tokens.current).forEach((sourceName) => {
        cancelToken(sourceName);
      });
    },
    []
  );

  return [generateToken, cancelToken] as const;
};
