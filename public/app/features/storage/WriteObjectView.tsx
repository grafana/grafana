import React, { useCallback, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, HorizontalGroup, Button, TextArea, Spinner } from '@grafana/ui';

interface Props {}

interface WriteObjectCommand {
  path: string;
  comment: string;
  body: string;
}

export function WriteObjectView({}: Props) {
  const [saving, setSaveing] = useState(false);
  const [result, setResult] = useState(undefined);

  // Call the backend service
  const doSave = useCallback((data: WriteObjectCommand) => {
    setSaveing(true);
    getBackendSrv()
      .post(`api/object/store/${data.path}?comment=${data.comment}`, data.body)
      .then((rsp) => {
        console.log('GOT', rsp);
        setResult(rsp);
        setSaveing(false);
      });
  }, []);

  return (
    <div>
      <Form<WriteObjectCommand>
        defaultValues={{
          path: 'path/to/item.dashboard',
          comment: 'Testing from UID',
          body: '{}',
        }}
        onSubmit={doSave}
      >
        {({ register, control, errors, getValues }) => (
          <>
            <Field label="Path ($uid.$kind), eventually GRN?" invalid={!!errors.path} error={errors.path?.message}>
              <Input
                {...register('path', {
                  //  validate: validateDashboardName(getValues),
                })}
                aria-label="Object kind"
              />
            </Field>
            <Field label="Comment" invalid={!!errors.comment} error={errors.comment?.message}>
              <Input
                {...register('comment', {
                  //  validate: validateDashboardName(getValues),
                })}
                aria-label="Object comment"
              />
            </Field>
            <Field label="Body" invalid={!!errors.body} error={errors.body?.message}>
              <TextArea
                {...register('body', {
                  //  validate: validateDashboardName(getValues),
                })}
                rows={10}
                aria-label="Object body"
                autoFocus
              />
            </Field>
            <HorizontalGroup>
              {saving ? (
                <Spinner />
              ) : (
                <Button type="submit" aria-label="Save dashboard button">
                  Save
                </Button>
              )}
            </HorizontalGroup>
          </>
        )}
      </Form>

      <br />
      {Boolean(result) && <pre>{JSON.stringify(result, null, '  ')}</pre>}
    </div>
  );
}
