import React from "react";
import PageHeader from "app/core/components/PageHeader/PageHeader";
import { NavModel, NavModelSrv } from "app/core/nav_model_srv";

export interface IState {
  navModel: NavModel;
}

export default class ServerStats extends React.Component<any, IState> {
  constructor(props) {
    super(props);

    const navModelSrv = new NavModelSrv();

    this.state = {
      navModel: navModelSrv.getNav("cfg", "admin", "server-stats", 1)
    };
  }

  render() {
    return (
      <PageHeader model={this.state.navModel}>
        <h2>ServerStats</h2>
      </PageHeader>
    );
  }
}
