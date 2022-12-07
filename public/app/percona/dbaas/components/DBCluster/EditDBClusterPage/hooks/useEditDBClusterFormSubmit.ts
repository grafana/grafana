import { useDispatch, useSelector } from 'react-redux';

import { addDbClusterAction } from '../../../../../shared/core/reducers/addDBCluster/addDBCluster';
import { getAddDbCluster } from '../../../../../shared/core/selectors';
import { AddCluster, DBClusterFormSubmitProps } from '../EditDBClusterPage.types';

export const useEditDBClusterFormSubmit = ({
  mode,
  showPMMAddressWarning,
}: DBClusterFormSubmitProps): [AddCluster, boolean | undefined, string, any] => {
  const dispatch = useDispatch();
  const { result, loading } = useSelector(getAddDbCluster);

  const addCluster = async (values: Record<string, any>, showPMMAddressWarning: boolean) => {
    await dispatch(addDbClusterAction({ values, setPMMAddress: showPMMAddressWarning }));
  };

  // TODO will be added in https://jira.percona.com/browse/PMM-11134
  // const editCluster = async (values: Record<string, any>, showPMMAddressWarning: boolean) => {
  //
  // };

  if (mode === 'create') {
    return [addCluster, loading, 'Create', result];
  } else {
    return [addCluster, loading, 'Edit', result];
  } // TODO will be changes to editCluster in https://jira.percona.com/browse/PMM-11134
};
