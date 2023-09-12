import React from 'react';

export const RenameByRegexHelper = () => {
  return (
    <div>
      <p>
        Use this transformation to rename parts of the query results using a regular expression and replacement pattern.
      </p>
      <p>
        You can specify a regular expression, which is only applied to matches, along with a replacement pattern that
        support back references. For example, let&apos;s imagine you&apos;re visualizing CPU usage per host and you want
        to remove the domain name. You could set the regex to <code>([^\.]+)\..+</code> and the replacement pattern to{' '}
        <code>$1</code>, <code>web-01.example.com</code> would become <code>web-01</code>.
      </p>
    </div>
  );
};
