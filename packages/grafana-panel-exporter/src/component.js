export class GrafanaPanelWC extends HTMLElement {
    static observedAttributes = ["dashboard-uid", "panel-id", "height", "width"];

    connectedCallback(){
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue){
        this[name] = newValue;
        this.render();
    }

    render(){
        if(!window.Grafana) {
            console.error("window.Grafana not found"); return;
        }
        if(!window.grafanaBootData?.settings?.datasources){
            console.error("window.grafanaBootData not found"); return;
        }

        let style = `height:${this.height+20}px; width:${this.width+20}px;`;
        this.innerHTML = `<div class="grafana panel exporter" style="${style}"></div>`;

        let bindingPoint = this.querySelector(".grafana.panel.exporter");

        window.Grafana.Context(this.props.dashboardUid).then((appContext)=>{
            window.Grafana.bindPanelToElement(
                appContext,
                this['dashboard-uid'],
                this['panel-id'],
                bindingPoint,
                parseInt(this.height),
                parseInt(this.width)
            );
        });
    }
}

customElements.define('grafana-panel', GrafanaPanelWC);