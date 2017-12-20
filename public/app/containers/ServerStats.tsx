import React from "react";
import { observer } from "mobx-react";
import PageHeader from "app/core/components/PageHeader/PageHeader";
import { NavModel, NavModelSrv } from "app/core/nav_model_srv";
import { store } from "app/store/store";

export interface IState {
  navModel: NavModel;
  search: any;
}

@observer
export default class ServerStats extends React.Component<any, any> {
  constructor(props) {
    super(props);

    const navModelSrv = new NavModelSrv();

    this.state = {
      navModel: navModelSrv.getNav("cfg", "admin", "server-stats", 1),
      search: store.search
    };
  }

  onClick = () => {
    this.state.search.search();
  };

  render() {
    console.log("render");
    return (
      <div>
        <PageHeader model={this.state.navModel} />

        <div className="page-container">
          name:
          <h2 onClick={this.onClick}>{this.state.search.name}</h2>
        </div>
      </div>
    );
  }
}
