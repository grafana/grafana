// Libraries
import _ from 'lodash';
// Utils & Services
import config from 'app/core/config';
export function buildNavModel(ds, plugin, currentPage) {
    var title = 'New';
    var subTitle = "Type: " + plugin.name;
    if (ds.id) {
        title = ds.name;
    }
    var main = {
        img: plugin.info.logos.large,
        id: 'ds-edit-' + plugin.id,
        subTitle: subTitle,
        url: '',
        text: title,
        breadcrumbs: [{ title: 'Data Sources', url: 'datasources' }],
        children: [
            {
                active: currentPage === 'datasource-settings',
                icon: 'fa fa-fw fa-sliders',
                id: 'datasource-settings',
                text: 'Settings',
                url: "datasources/edit/" + ds.id,
            },
        ],
    };
    var hasDashboards = _.find(plugin.includes, { type: 'dashboard' }) !== undefined;
    if (hasDashboards && ds.id) {
        main.children.push({
            active: currentPage === 'datasource-dashboards',
            icon: 'fa fa-fw fa-th-large',
            id: 'datasource-dashboards',
            text: 'Dashboards',
            url: "datasources/edit/" + ds.id + "/dashboards",
        });
    }
    if (config.buildInfo.isEnterprise) {
        main.children.push({
            active: currentPage === 'datasource-permissions',
            icon: 'fa fa-fw fa-lock',
            id: 'datasource-permissions',
            text: 'Permissions',
            url: "datasources/edit/" + ds.id + "/permissions",
        });
    }
    return {
        main: main,
        node: _.find(main.children, { active: true }),
    };
}
//# sourceMappingURL=navModel.js.map