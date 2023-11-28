import { __awaiter } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { config } from '@grafana/runtime';
import { Button, Input, Form, Field, HorizontalGroup, LinkButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { validationSrv } from '../../manage-dashboards/services/ValidationSrv';
import { createNewFolder } from '../state/actions';
const mapDispatchToProps = {
    createNewFolder,
};
const connector = connect(null, mapDispatchToProps);
const initialFormModel = { folderName: '' };
const pageNav = {
    text: 'Create a new folder',
    subTitle: 'Folders provide a way to group dashboards and alert rules.',
};
function NewDashboardsFolder({ createNewFolder }) {
    const [queryParams] = useQueryParams();
    const onSubmit = (formData) => {
        const folderUid = typeof queryParams['folderUid'] === 'string' ? queryParams['folderUid'] : undefined;
        createNewFolder(formData.folderName, folderUid);
    };
    const validateFolderName = (folderName) => {
        return validationSrv
            .validateNewFolderName(folderName)
            .then(() => {
            return true;
        })
            .catch((e) => {
            return e.message;
        });
    };
    return (React.createElement(Page, { navId: "dashboards/browse", pageNav: pageNav },
        React.createElement(Page.Contents, null,
            React.createElement(Form, { defaultValues: initialFormModel, onSubmit: onSubmit }, ({ register, errors }) => (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Folder name", invalid: !!errors.folderName, error: errors.folderName && errors.folderName.message },
                    React.createElement(Input, Object.assign({ id: "folder-name-input" }, register('folderName', {
                        required: 'Folder name is required.',
                        validate: (v) => __awaiter(this, void 0, void 0, function* () { return yield validateFolderName(v); }),
                    })))),
                React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { type: "submit" }, "Create"),
                    React.createElement(LinkButton, { variant: "secondary", href: `${config.appSubUrl}/dashboards` }, "Cancel"))))))));
}
export default connector(NewDashboardsFolder);
//# sourceMappingURL=NewDashboardsFolder.js.map