import { useCallback } from 'react';
import { useLocalStorage } from 'react-use';

export const useStoredBoolean = (key: string, initialValue: boolean): [boolean, (value: boolean) => void] => {
  const [value, setValue] = useLocalStorage<boolean>(key, initialValue, {
    raw: false,
    serializer: (value: boolean) => value.toString(),
    deserializer: (value: string) => value === 'true',
  });
  return [value ?? false, useCallback((nextValue: boolean) => setValue(nextValue), [setValue])];
};
