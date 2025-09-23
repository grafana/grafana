import { reduceError } from './utils';

const SAMPLE_500_PAGE = `<body style="background-color: #666666; color: black;">
<center>
<h2 style='font-family: "Arial"'>
<p>Graphite encountered an unexpected error while handling your request.</p>
<p>Please contact your site administrator if the problem persists.</p>
</h2>
<br/>
<div style="width: 50%; text-align: center; font-family: monospace; background-color: black; font-weight: bold; color: #ff4422;">

</div>

<div style="width: 70%; text-align: left; background-color: black; color: #44ff22; border: thin solid gray;">
<pre>
Traceback (most recent call last):
  File &quot;/usr/lib/python2.7/dist-packages/django/core/handlers/base.py&quot;, line 112, in get_response
    response = wrapped_callback(request, *callback_args, **callback_kwargs)
  File &quot;/var/lib/graphite/webapp/graphite/render/views.py&quot;, line 125, in renderView
    seriesList = evaluateTarget(requestContext, target)
  File &quot;/var/lib/graphite/webapp/graphite/render/evaluator.py&quot;, line 10, in evaluateTarget
    result = evaluateTokens(requestContext, tokens)
  File &quot;/var/lib/graphite/webapp/graphite/render/evaluator.py&quot;, line 21, in evaluateTokens
    return evaluateTokens(requestContext, tokens.expression)
  File &quot;/var/lib/graphite/webapp/graphite/render/evaluator.py&quot;, line 27, in evaluateTokens
    func = SeriesFunctions[tokens.call.func]
KeyError: u&#39;aliasByNodde&#39;

</pre>
</div>

</center>
`;

describe('Graphite utils', () => {
  it('should reduce HTML based errors', () => {
    const error = {
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

  it('should return original error for non-HTML 500 error pages', () => {
    const error = {
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

  it('should return original error for non 500 errors', () => {
    const error = {
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

  it('should return original error for errors other than FetchError (not data property)', () => {
    const error = {
      message: 'ERROR MESSAGE',
    };

    expect(reduceError(error)).toMatchObject({
      message: 'ERROR MESSAGE',
    });
  });
});
