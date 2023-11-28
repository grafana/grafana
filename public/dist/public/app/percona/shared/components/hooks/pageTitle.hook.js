import { useEffect, useState } from 'react';
import { Branding } from 'app/core/components/Branding/Branding';
export const usePageTitle = (title) => {
    const [pageTitle, setPageTitle] = useState(title);
    useEffect(() => {
        document.title = `${pageTitle ? pageTitle + ' - ' : ''}${Branding.AppTitle}`;
    }, [pageTitle]);
    return [pageTitle, setPageTitle];
};
//# sourceMappingURL=pageTitle.hook.js.map