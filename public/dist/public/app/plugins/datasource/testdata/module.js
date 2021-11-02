import { DataSourcePlugin } from '@grafana/data';
import { TestDataDataSource } from './datasource';
import { TestInfoTab } from './TestInfoTab';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';
import { LiveMeasurementsSupport } from 'app/features/live/measurements/measurementsSupport';
var TestDataAnnotationsQueryCtrl = /** @class */ (function () {
    function TestDataAnnotationsQueryCtrl() {
    }
    TestDataAnnotationsQueryCtrl.template = '<h2>Annotation scenario</h2>';
    return TestDataAnnotationsQueryCtrl;
}());
export var plugin = new DataSourcePlugin(TestDataDataSource)
    .setConfigEditor(ConfigEditor)
    .setQueryEditor(QueryEditor)
    .setChannelSupport(new LiveMeasurementsSupport())
    .setAnnotationQueryCtrl(TestDataAnnotationsQueryCtrl)
    .addConfigPage({
    title: 'Setup',
    icon: 'list-ul',
    body: TestInfoTab,
    id: 'setup',
});
//# sourceMappingURL=module.js.map