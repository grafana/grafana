import './style.css';
import { oneDark } from '@codemirror/theme-one-dark';

import { EditorView, basicSetup } from './codemirror.ts';
import { prql } from './lang-prql/prql.ts';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>PRQL CodeMirror demo</h1>
    <p>
      PRQL is a modern language for transforming data — a simple, powerful, pipelined SQL replacement.
    </p>
    <div id="editor"></div>
  </div>
`;

let doc = `from invoices
filter invoice_date >= @1970-01-16
derive {
  transaction_fees = 0.8,
  income = total - transaction_fees
}
filter income > 1
group customer_id (
  aggregate {
    average total,
    sum_income = sum income,
    ct = count total,
  }
)
sort {-sum_income}
take 10
join c=customers (==customer_id)
derive name = f"{c.last_name}, {c.first_name}"
select {
  c.customer_id, name, sum_income
}
derive db_version = s"version()"
`;

new EditorView({
  doc,
  extensions: [basicSetup, oneDark, prql()],
  parent: document.getElementById('editor')!,
});
