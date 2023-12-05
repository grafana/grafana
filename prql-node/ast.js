import pkg from 'node-sql-parser';
const { Parser } = pkg;

const sql = process.argv[2];

const parser = new Parser();
// const ast = parser.astify(sql); // mysql sql grammer parsed by default

const { tableList, columnList, ast } = parser.parse(sql);

console.log(tableList);
