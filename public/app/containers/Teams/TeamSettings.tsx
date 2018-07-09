import React from 'react';
import { hot } from 'react-hot-loader';
import { inject, observer } from 'mobx-react';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { NavStore } from 'app/stores/NavStore/NavStore';

interface Props {
  nav: typeof NavStore.Type;
}

@inject('nav')
@observer
export class TeamSettings extends React.Component<Props, any> {
  constructor(props) {
    super(props);
    const { nav } = this.props;

    nav.load('cfg', 'admin', 'server-stats');
  }

  // loadStore() {
  //   const { nav, folder, view } = this.props;
  //   return folder.load(view.routeParams.get('uid') as string).then(res => {
  //     view.updatePathAndQuery(`${res.url}/permissions`, {}, {});
  //     return nav.initFolderNav(toJS(folder.folder), 'manage-folder-permissions');
  //   });
  // }

  render() {
    const { nav } = this.props;
    return (
      <div>
        <PageHeader model={nav as any} />
        <div className="page-container page-body">Teams</div>
      </div>
    );
  }
}

export default hot(module)(TeamSettings);
