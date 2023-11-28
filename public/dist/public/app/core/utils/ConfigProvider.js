import React, { useEffect, useState } from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';
import { ThemeContext } from '@grafana/data';
import { ThemeChangedEvent, config } from '@grafana/runtime';
import { appEvents } from '../core';
import 'react-loading-skeleton/dist/skeleton.css';
export const ThemeProvider = ({ children, value }) => {
    const [theme, setTheme] = useState(value);
    useEffect(() => {
        const sub = appEvents.subscribe(ThemeChangedEvent, (event) => {
            config.theme2 = event.payload;
            setTheme(event.payload);
        });
        return () => sub.unsubscribe();
    }, []);
    return (React.createElement(ThemeContext.Provider, { value: theme },
        React.createElement(SkeletonTheme, { baseColor: theme.colors.background.secondary, highlightColor: theme.colors.emphasize(theme.colors.background.secondary), borderRadius: theme.shape.radius.default }, children)));
};
export const provideTheme = (component, theme) => {
    return function ThemeProviderWrapper(props) {
        return React.createElement(ThemeProvider, { value: theme }, React.createElement(component, Object.assign({}, props)));
    };
};
//# sourceMappingURL=ConfigProvider.js.map