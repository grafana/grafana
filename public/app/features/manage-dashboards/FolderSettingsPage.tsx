import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
import { NavModel, StoreState } from 'app/types';
import { getFolderByUid } from './state/actions';

export interface Props {
  navModel: NavModel;
  folderUid: string;
  getFolderByUid: typeof getFolderByUid;
}

export class FolderSettingsPage extends PureComponent<Props> {
  // formSnapshot: any;
  //
  componentDidMount() {
    this.props.getFolderByUid(this.props.folderUid);
  }
  //
  // loadStore() {
  //   const { nav, folder, view } = this.props;
  //
  //   return folder.load(view.routeParams.get('uid') as string).then(res => {
  //     this.formSnapshot = getSnapshot(folder);
  //     view.updatePathAndQuery(`${res.url}/settings`, {}, {});
  //
  //     return nav.initFolderNav(toJS(folder.folder), 'manage-folder-settings');
  //   });
  // }

  // onTitleChange(evt) {
  //   this.props.folder.setTitle(this.getFormSnapshot().folder.title, evt.target.value);
  // }
  //
  // getFormSnapshot() {
  //   if (!this.formSnapshot) {
  //     this.formSnapshot = getSnapshot(this.props.folder);
  //   }
  //
  //   return this.formSnapshot;
  // }
  //
  // save(evt) {
  //   if (evt) {
  //     evt.stopPropagation();
  //     evt.preventDefault();
  //   }
  //
  //   const { nav, folder, view } = this.props;
  //
  //   folder
  //     .saveFolder({ overwrite: false })
  //     .then(newUrl => {
  //       view.updatePathAndQuery(newUrl, {}, {});
  //
  //       appEvents.emit('dashboard-saved');
  //       appEvents.emit('alert-success', ['Folder saved']);
  //     })
  //     .then(() => {
  //       return nav.initFolderNav(toJS(folder.folder), 'manage-folder-settings');
  //     })
  //     .catch(this.handleSaveFolderError.bind(this));
  // }
  //
  // delete(evt) {
  //   if (evt) {
  //     evt.stopPropagation();
  //     evt.preventDefault();
  //   }
  //
  //   const { folder, view } = this.props;
  //   const title = folder.folder.title;
  //
  //   appEvents.emit('confirm-modal', {
  //     title: 'Delete',
  //     text: `Do you want to delete this folder and all its dashboards?`,
  //     icon: 'fa-trash',
  //     yesText: 'Delete',
  //     onConfirm: () => {
  //       return folder.deleteFolder().then(() => {
  //         appEvents.emit('alert-success', ['Folder Deleted', `${title} has been deleted`]);
  //         view.updatePathAndQuery('dashboards', '', '');
  //       });
  //     },
  //   });
  // }
  //
  // handleSaveFolderError(err) {
  //   if (err.data && err.data.status === 'version-mismatch') {
  //     err.isHandled = true;
  //
  //     const { nav, folder, view } = this.props;
  //
  //     appEvents.emit('confirm-modal', {
  //       title: 'Conflict',
  //       text: 'Someone else has updated this folder.',
  //       text2: 'Would you still like to save this folder?',
  //       yesText: 'Save & Overwrite',
  //       icon: 'fa-warning',
  //       onConfirm: () => {
  //         folder
  //           .saveFolder({ overwrite: true })
  //           .then(newUrl => {
  //             view.updatePathAndQuery(newUrl, {}, {});
  //
  //             appEvents.emit('dashboard-saved');
  //             appEvents.emit('alert-success', ['Folder saved']);
  //           })
  //           .then(() => {
  //             return nav.initFolderNav(toJS(folder.folder), 'manage-folder-settings');
  //           });
  //       },
  //     });
  //   }
  // }

  render() {
    const { navModel } = this.props;

    // if (!folder.folder || !nav.main) {
    //   return <h2>Loading</h2>;
    // }

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <h2 className="page-sub-heading">Folder Settings</h2>
        </div>
      </div>
    );
  }

  // asd()  {
  //   <div className="section gf-form-group">
  //           <form name="folderSettingsForm" onSubmit={this.save.bind(this)}>
  //             <div className="gf-form">
  //               <label className="gf-form-label width-7">Name</label>
  //               <input
  //                 type="text"
  //                 className="gf-form-input width-30"
  //                 value={folder.folder.title}
  //                 onChange={this.onTitleChange.bind(this)}
  //               />
  //             </div>
  //             <div className="gf-form-button-row">
  //               <button
  //                 type="submit"
  //                 className="btn btn-success"
  //                 disabled={!folder.folder.canSave || !folder.folder.hasChanged}
  //               >
  //                 <i className="fa fa-save" /> Save
  //               </button>
  //               <button className="btn btn-danger" onClick={this.delete.bind(this)} disabled={!folder.folder.canSave}>
  //                 <i className="fa fa-trash" /> Delete
  //               </button>
  //             </div>
  //           </form>
  //         </div>
  //
  // }
}

const mapStateToProps = (state: StoreState) => {
  const uid = state.location.routeParams.uid;

  return {
    navModel: getNavModel(state.navIndex, `folder-settings-${uid}`),
    folderUid: uid,
  };
};

const mapDispatchToProps = {
  getFolderByUid,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(FolderSettingsPage));
