import { reduceError } from './utils';
var SAMPLE_500_PAGE = "<body style=\"background-color: #666666; color: black;\">\n<center>\n<h2 style='font-family: \"Arial\"'>\n<p>Graphite encountered an unexpected error while handling your request.</p>\n<p>Please contact your site administrator if the problem persists.</p>\n</h2>\n<br/>\n<div style=\"width: 50%; text-align: center; font-family: monospace; background-color: black; font-weight: bold; color: #ff4422;\">\n\n</div>\n\n<div style=\"width: 70%; text-align: left; background-color: black; color: #44ff22; border: thin solid gray;\">\n<pre>\nTraceback (most recent call last):\n  File &quot;/usr/lib/python2.7/dist-packages/django/core/handlers/base.py&quot;, line 112, in get_response\n    response = wrapped_callback(request, *callback_args, **callback_kwargs)\n  File &quot;/var/lib/graphite/webapp/graphite/render/views.py&quot;, line 125, in renderView\n    seriesList = evaluateTarget(requestContext, target)\n  File &quot;/var/lib/graphite/webapp/graphite/render/evaluator.py&quot;, line 10, in evaluateTarget\n    result = evaluateTokens(requestContext, tokens)\n  File &quot;/var/lib/graphite/webapp/graphite/render/evaluator.py&quot;, line 21, in evaluateTokens\n    return evaluateTokens(requestContext, tokens.expression)\n  File &quot;/var/lib/graphite/webapp/graphite/render/evaluator.py&quot;, line 27, in evaluateTokens\n    func = SeriesFunctions[tokens.call.func]\nKeyError: u&#39;aliasByNodde&#39;\n\n</pre>\n</div>\n\n</center>\n";
describe('Graphite utils', function () {
    it('should reduce HTML based errors', function () {
        var error = {
            status: 500,
            data: {
                message: SAMPLE_500_PAGE,
            },
        };
        expect(reduceError(error)).toMatchObject({
            data: {
                message: 'Graphite encountered an unexpected error while handling your request. KeyError: aliasByNodde',
            },
        });
    });
    it('should return original error for non-HTML 500 error pages', function () {
        var error = {
            status: 500,
            data: {
                message: 'ERROR MESSAGE',
            },
        };
        expect(reduceError(error)).toMatchObject({
            data: {
                message: 'ERROR MESSAGE',
            },
        });
    });
    it('should return original error for non 500 errors', function () {
        var error = {
            status: 400,
            data: {
                message: 'ERROR MESSAGE',
            },
        };
        expect(reduceError(error)).toMatchObject({
            data: {
                message: 'ERROR MESSAGE',
            },
        });
    });
    it('should return original error for errors other than FetchError (not data property)', function () {
        var error = {
            message: 'ERROR MESSAGE',
        };
        expect(reduceError(error)).toMatchObject({
            message: 'ERROR MESSAGE',
        });
    });
});
//# sourceMappingURL=utils.test.js.map