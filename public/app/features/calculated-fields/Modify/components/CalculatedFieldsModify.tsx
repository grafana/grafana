import { FC, memo } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModel } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

import { FieldsForm } from './FieldsForm';

interface ConnectedProps {
  navModel: NavModel;
}

export const CalculatedFieldsModify: FC<ConnectedProps> = memo(({ navModel }) => {
  const params = useParams<CalculatedFieldsModifyProps>();
  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={false}>
        <FieldsForm uid={params.uid} action={params.action!} />
      </Page.Contents>
    </Page>
  );
});
CalculatedFieldsModify.displayName = 'CalculatedFieldsModify';

type CalculatedFieldsModifyProps = {
  uid: string;
  action: string;
};

interface CalcFieldListProps extends Omit<GrafanaRouteComponentProps<CalculatedFieldsModifyProps>, 'match'> {}

const mapStateToProps: MapStateToProps<ConnectedProps, CalcFieldListProps, StoreState> = (state, props) => {
  return {
    navModel: getNavModel(state.navIndex, 'calc-fields'),
  };
};

export default connect(mapStateToProps)(CalculatedFieldsModify);
