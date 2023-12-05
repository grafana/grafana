// import { EditorState } from '@codemirror/state';
// import { oneDark } from '@codemirror/theme-one-dark';
// import React, { useEffect, useRef } from 'react';
//
// import { PRQLEditorView, basicSetup } from './codemirror';
// import { prql } from './lang-prql/prql';
//
// let doc = `from invoices
// filter invoice_date >= @1970-01-16
// derive {
//   transaction_fees = 0.8,
//   income = total - transaction_fees
// }
// filter income > 1
// group customer_id (
//   aggregate {
//     average total,
//     sum_income = sum income,
//     ct = count total,
//   }
// )
// sort {-sum_income}
// take 10
// join c=customers (==customer_id)
// derive name = f"{c.last_name}, {c.first_name}"
// select {
//   c.customer_id, name, sum_income
// }
// derive db_version = s"version()"
// `;
//
// export const PRQLEditor = () => {
//   const editor = useRef(null);
//
//   useEffect(() => {
//     const startState = EditorState.create({
//       doc: doc,
//       extensions: [basicSetup, oneDark, prql()],
//     });
//
//     const view = new PRQLEditorView({
//       state: startState,
//       parent: editor.current!,
//     });
//
//     return () => {
//       view.destroy();
//     };
//   }, []);
//
//   return (
//     <div id="editor">
//       <div ref={editor}></div>;
//     </div>
//   );
// };
