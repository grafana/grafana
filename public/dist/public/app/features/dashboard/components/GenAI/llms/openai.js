/**
 * OpenAI API client.
 *
 * This module contains functions used to make requests to the OpenAI API via
 * the Grafana LLM app plugin. That plugin must be installed, enabled and configured
 * in order for these functions to work.
 *
 * The {@link enabled} function can be used to check if the plugin is enabled and configured.
 */
import { __awaiter } from "tslib";
import { pipe } from 'rxjs';
import { filter, map, scan, takeWhile, tap } from 'rxjs/operators';
import { isLiveChannelMessageEvent, LiveChannelScope, } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv, logDebug } from '@grafana/runtime';
import { LLM_PLUGIN_ID, LLM_PLUGIN_ROUTE, setLLMPluginVersion } from './constants';
const OPENAI_CHAT_COMPLETIONS_PATH = 'openai/v1/chat/completions';
/** Return true if the message is a 'content' message. */
export function isContentMessage(message) {
    return typeof message === 'object' && message !== null && 'content' in message;
}
/** Return true if the message is a 'done' message. */
export function isDoneMessage(message) {
    return typeof message === 'object' && message !== null && 'done' in message;
}
/** Return true if the response is an error response. */
export function isErrorResponse(response) {
    return typeof response === 'object' && response !== null && 'error' in response;
}
/**
 * An rxjs operator that extracts the content messages from a stream of chat completion responses.
 *
 * @returns An observable that emits the content messages. Each emission will be a string containing the
 *         token emitted by the model.
 * @example <caption>Example of reading all tokens in a stream.</caption>
 * const stream = streamChatCompletions({ model: 'gpt-3.5-turbo', messages: [
 *   { role: 'system', content: 'You are a great bot.' },
 *   { role: 'user', content: 'Hello, bot.' },
 * ]}).pipe(extractContent());
 * stream.subscribe({ next: console.log, error: console.error });
 * // Output:
 * // ['Hello', '? ', 'How ', 'are ', 'you', '?']
 */
export function extractContent() {
    return pipe(filter((response) => isContentMessage(response.choices[0].delta)), 
    // The type assertion is needed here because the type predicate above doesn't seem to propagate.
    map((response) => response.choices[0].delta.content));
}
/**
 * An rxjs operator that accumulates the content messages from a stream of chat completion responses.
 *
 * @returns An observable that emits the accumulated content messages. Each emission will be a string containing the
 *         content of all messages received so far.
 * @example
 * const stream = streamChatCompletions({ model: 'gpt-3.5-turbo', messages: [
 *   { role: 'system', content: 'You are a great bot.' },
 *   { role: 'user', content: 'Hello, bot.' },
 * ]}).pipe(accumulateContent());
 * stream.subscribe({ next: console.log, error: console.error });
 * // Output:
 * // ['Hello', 'Hello! ', 'Hello! How ', 'Hello! How are ', 'Hello! How are you', 'Hello! How are you?']
 */
export function accumulateContent() {
    return pipe(extractContent(), scan((acc, curr) => acc + curr, ''));
}
/**
 * Make a request to OpenAI's chat-completions API via the Grafana LLM plugin proxy.
 */
export function chatCompletions(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield getBackendSrv().post('/api/plugins/grafana-llm-app/resources/openai/v1/chat/completions', request, {
            headers: { 'Content-Type': 'application/json' },
        });
        return response;
    });
}
/**
 * Make a streaming request to OpenAI's chat-completions API via the Grafana LLM plugin proxy.
 *
 * A stream of tokens will be returned as an `Observable<string>`. Use the `extractContent` operator to
 * filter the stream to only content messages, or the `accumulateContent` operator to obtain a stream of
 * accumulated content messages.
 *
 * The 'done' message will not be emitted; the stream will simply end when this message is encountered.
 *
 * @example <caption>Example of reading all tokens in a stream.</caption>
 * const stream = streamChatCompletions({ model: 'gpt-3.5-turbo', messages: [
 *   { role: 'system', content: 'You are a great bot.' },
 *   { role: 'user', content: 'Hello, bot.' },
 * ]}).pipe(extractContent());
 * stream.subscribe({ next: console.log, error: console.error });
 * // Output:
 * // ['Hello', '? ', 'How ', 'are ', 'you', '?']
 *
 * @example <caption>Example of accumulating tokens in a stream.</caption>
 * const stream = streamChatCompletions({ model: 'gpt-3.5-turbo', messages: [
 *   { role: 'system', content: 'You are a great bot.' },
 *   { role: 'user', content: 'Hello, bot.' },
 * ]}).pipe(accumulateContent());
 * stream.subscribe({ next: console.log, error: console.error });
 * // Output:
 * // ['Hello', 'Hello! ', 'Hello! How ', 'Hello! How are ', 'Hello! How are you', 'Hello! How are you?']
 */
export function streamChatCompletions(request) {
    const channel = {
        scope: LiveChannelScope.Plugin,
        namespace: LLM_PLUGIN_ID,
        path: OPENAI_CHAT_COMPLETIONS_PATH + '/' + self.crypto.randomUUID(),
        data: request,
    };
    const messages = getGrafanaLiveSrv()
        .getStream(channel)
        .pipe(filter((event) => isLiveChannelMessageEvent(event)));
    return messages.pipe(tap((event) => {
        if (isErrorResponse(event.message)) {
            throw new Error(event.message.error);
        }
    }), takeWhile((event) => isErrorResponse(event.message) || !isDoneMessage(event.message.choices[0].delta)), map((event) => event.message));
}
let loggedWarning = false;
/** Check if the OpenAI API is enabled via the LLM plugin. */
export const enabled = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const settings = yield getBackendSrv().get(`${LLM_PLUGIN_ROUTE}/settings`, undefined, undefined, {
            showSuccessAlert: false,
            showErrorAlert: false,
        });
        setLLMPluginVersion(settings.info.version);
        return (_a = settings.enabled) !== null && _a !== void 0 ? _a : false;
    }
    catch (e) {
        if (!loggedWarning) {
            logDebug(String(e));
            logDebug('Failed to check if OpenAI is enabled. This is expected if the Grafana LLM plugin is not installed, and the above error can be ignored.');
            loggedWarning = true;
        }
        return false;
    }
});
//# sourceMappingURL=openai.js.map