import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { ClipboardButton, Icon, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { getPerconaUser } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useSelector } from 'app/types';
import { useCancelToken } from '../../../shared/components/hooks/cancelToken.hook';
import { WidgetWrapper } from '../WidgetWrapper/WidgetWrapper';
import { CONTACT_CANCEL_TOKEN } from './Contact.constants';
import { Messages } from './Contact.messages';
import { ContactService } from './Contact.service';
import { getStyles } from './Contact.styles';
const Contact = () => {
    const [pendingRequest, setPendingRequest] = useState(true);
    const [data, setData] = useState();
    const { isPlatformUser } = useSelector(getPerconaUser);
    const [generateToken] = useCancelToken();
    const styles = useStyles2(getStyles);
    const getData = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setPendingRequest(true);
        try {
            const contact = yield ContactService.getContact(generateToken(CONTACT_CANCEL_TOKEN));
            setData(contact);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setPendingRequest(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    useEffect(() => {
        if (isPlatformUser === true) {
            getData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlatformUser]);
    const onClipboardCopy = useCallback(() => {
        appEvents.emit(AppEvents.alertSuccess, [Messages.copiedSuccessfully]);
    }, []);
    const getText = useCallback(() => {
        return data ? data.email : '';
    }, [data]);
    return (React.createElement(WidgetWrapper, { title: Messages.title, isPending: pendingRequest },
        React.createElement("span", { className: styles.contactTitle }, Messages.customerSuccess),
        data && (React.createElement("div", { className: styles.nameWrapper },
            React.createElement(Icon, { name: 'user', size: "lg" }),
            React.createElement("span", { className: styles.name, "data-testid": "contact-name" }, data.name),
            React.createElement(ClipboardButton, { title: data.email, className: styles.clipboardButton, onClipboardCopy: onClipboardCopy, getText: getText, "data-testid": "contact-email-icon" },
                React.createElement(Icon, { name: 'envelope', size: "lg" }))))));
};
export default Contact;
//# sourceMappingURL=Contact.js.map