import { css, cx } from '@emotion/css';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import React, { useState } from 'react';
import { useDebounce } from 'react-use';
import { renderTextPanelMarkdown, textUtil } from '@grafana/data';
import { CustomScrollbar, CodeEditor, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { defaultCodeOptions, TextMode } from './panelcfg.gen';
export function TextPanel(props) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const [processed, setProcessed] = useState({
        mode: props.options.mode,
        content: processContent(props.options, props.replaceVariables, config.disableSanitizeHtml),
    });
    useDebounce(() => {
        const { options, replaceVariables } = props;
        const content = processContent(options, replaceVariables, config.disableSanitizeHtml);
        if (content !== processed.content || options.mode !== processed.mode) {
            setProcessed({
                mode: options.mode,
                content,
            });
        }
    }, 100, [props]);
    if (processed.mode === TextMode.Code) {
        const code = (_a = props.options.code) !== null && _a !== void 0 ? _a : defaultCodeOptions;
        return (React.createElement(CodeEditor, { key: `${code.showLineNumbers}/${code.showMiniMap}`, value: processed.content, language: (_b = code.language) !== null && _b !== void 0 ? _b : defaultCodeOptions.language, width: props.width, height: props.height, containerStyles: styles.codeEditorContainer, showMiniMap: code.showMiniMap, showLineNumbers: code.showLineNumbers, readOnly: true }));
    }
    return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", className: styles.containStrict },
        React.createElement(DangerouslySetHtmlContent, { html: processed.content, className: styles.markdown, "data-testid": "TextPanel-converted-content" })));
}
function processContent(options, interpolate, disableSanitizeHtml) {
    var _a;
    let { mode, content } = options;
    if (!content) {
        return '';
    }
    // Variables must be interpolated before content is converted to markdown so using variables
    // in URLs work properly
    content = interpolate(content, {}, ((_a = options.code) === null || _a === void 0 ? void 0 : _a.language) === 'json' ? 'json' : 'html');
    switch (mode) {
        case TextMode.Code:
            break; // nothing
        case TextMode.HTML:
            if (!disableSanitizeHtml) {
                content = textUtil.sanitizeTextPanelContent(content);
            }
            break;
        case TextMode.Markdown:
        default:
            // default to markdown
            content = renderTextPanelMarkdown(content, {
                noSanitize: disableSanitizeHtml,
            });
    }
    return content;
}
const getStyles = (theme) => ({
    codeEditorContainer: css `
    .monaco-editor .margin,
    .monaco-editor-background {
      background-color: ${theme.colors.background.primary};
    }
  `,
    markdown: cx('markdown-html', css `
      height: 100%;
    `),
    containStrict: css({
        contain: 'strict',
    }),
});
//# sourceMappingURL=TextPanel.js.map