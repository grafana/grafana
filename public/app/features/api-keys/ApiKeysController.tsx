import { FC, useCallback, useState } from 'react';

interface Api {
  isAdding: boolean;
  toggleIsAdding: () => void;
}

interface Props {
  children: (props: Api) => JSX.Element;
}

export const ApiKeysController: FC<Props> = ({ children }) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const toggleIsAdding = useCallback(() => {
    setIsAdding(!isAdding);
  }, [isAdding]);

  return children({ isAdding, toggleIsAdding });
};
