// this will be the client side API for the panelExporter
// it will define a web component and a react component
// it will export the react component as an ESM and a CJS ES2018 module
// it will export the web component as an ESM.

import React from "react";

class GrafanaPanel extends React.Component {
    constructor(props) {
        super(props);
        this.domTarget = React.createRef();
        this.bound = false;
    }

    bindGrafana() {
        if(!this.bound){
            let doLoginRedirect = (this.props.loginRedirect === undefined || !!this.props.loginRedirect);
            window.Grafana.Context(this.props.dashboardUid, doLoginRedirect).then((appContext)=>{
                // signature: function(appContext, dashboardUid, panelId, HTML Element, height, width)
                window.Grafana.bindPanelToElement(
                    appContext,
                    props.dashboardUid,
                    props.panelId,
                    myElem,
                    parseInt(props.height),
                    parseInt(props.width)
                );
                this.bound = true;
            }).catch((err)=>{
                console.log(err);
                setTimeout(this.bindGrafana(), 1000);
            });
        }
    }

    componentDidMount() {
        if(!window.Grafana) {
            console.error("window.Grafana not found"); return;
        }
        if(!window.grafanaBootData?.settings?.datasources){
            console.error("window.grafanaBootData not found"); return;
        }
        let myElem = this.domTarget.current;
        let props = this.props;
        window.Grafana.Context(this.props.dashboardUid).then((appContext)=>{
            console.log("on the client side. appContext is now", appContext)
            // signature: function(appContext, dashboardUid, panelId, HTML Element, height, width)
            window.Grafana.bindPanelToElement(
                appContext,
                props.dashboardUid,
                props.panelId,
                myElem,
                parseInt(props.height),
                parseInt(props.width)
            );
        })
    }

    render() {
        let styles = {
            height: parseInt(this.props.height) + "px",
            width: parseInt(this.props.width) + "px",
        };
        return <div className="grafana-panel-exporter" style={styles}>
            <div ref={this.domTarget} />;
        </div>
    }
}

export { GrafanaPanel };
export default GrafanaPanel;