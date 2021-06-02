import { useEffect, useState } from 'react';
import { getLocationSrv } from '@grafana/runtime';

type ParameterHook = (key: string, defaultValue?: string) => [string, (parameter: string) => void];

const useQueryParams: ParameterHook = (key, defaultValue) => {
  const query = new URLSearchParams(window.location.search);
  const [value, setValue] = useState<string>(defaultValue ?? '');

  const setParameter = (parameter: string) => {
    getLocationSrv().update({
      query: { [key]: parameter },
      partial: true,
    });

    setValue(parameter);
  };

  useEffect(() => {
    const queryValue = query.get(key);

    if (queryValue) {
      setValue(queryValue);
    } else {
      setParameter(value);
    }
  }, [key]);

  return [value, setParameter];
};

export default useQueryParams;
