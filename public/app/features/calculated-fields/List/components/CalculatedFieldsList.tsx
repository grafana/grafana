import { FC, memo } from 'react';
import { connect, MapStateToProps } from 'react-redux';

import { NavModel } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

import { ManageLists } from './ManageList';

interface ConnectedProps {
  navModel: NavModel;
}

export const CalculatedFieldsList: FC<ConnectedProps> = memo(({ navModel }) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={false}>
        <ManageLists />
      </Page.Contents>
    </Page>
  );
});
CalculatedFieldsList.displayName = 'CalculatedFieldsList';

interface CalcFieldListProps extends GrafanaRouteComponentProps<{}> {}

const mapStateToProps: MapStateToProps<ConnectedProps, CalcFieldListProps, StoreState> = (state, props) => {
  return {
    navModel: getNavModel(state.navIndex, 'calc-fields'),
  };
};

export default connect(mapStateToProps)(CalculatedFieldsList);
