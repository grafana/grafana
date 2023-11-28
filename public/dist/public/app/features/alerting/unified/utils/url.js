import { config } from '@grafana/runtime';
export function createUrl(path, queryParams) {
    const searchParams = new URLSearchParams(queryParams);
    const searchParamsString = searchParams.toString();
    return `${config.appSubUrl}${path}${searchParamsString ? `?${searchParamsString}` : ''}`;
}
export function createAbsoluteUrl(path, queryParams) {
    const searchParams = new URLSearchParams(queryParams);
    const searchParamsString = searchParams.toString();
    try {
        const baseUrl = new URL(config.appSubUrl, config.appUrl);
        baseUrl.pathname = path;
        return `${baseUrl.href}${searchParamsString ? `?${searchParamsString}` : ''}`;
    }
    catch (err) {
        return createUrl(path, queryParams);
    }
}
//# sourceMappingURL=url.js.map