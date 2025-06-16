export class GrafanaPanelComponent extends HTMLElement {
    static observedAttributes = ["dashboard-uid", "panel-id", "height", "width", "login-redirect"];

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

        let style = `height:${parseInt(this.height)}px; width:${parseInt(this.width)}px;`;
        this.innerHTML = `<div class="grafana-panel-exporter" style="${style}"></div>`;

        let bindingPoint = this.querySelector(".grafana-panel-exporter");

        let doLoginRedirect = typeof(this['login-redirect']) === "undefined" || this['login-redirect'] === true;

        window.Grafana.Context(this['dashboard-uid'], doLoginRedirect).then((appContext)=>{
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

customElements.define('grafana-panel', GrafanaPanelComponent);