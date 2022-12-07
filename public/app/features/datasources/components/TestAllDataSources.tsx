import { FC, useEffect } from 'react';

import { useDispatch } from 'app/types';

import { testAllDataSources } from '../state';

export const TestAllDataSources: FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(testAllDataSources());
  }, [dispatch]);

  return null;
};
