import { runTests, printResults } from './harness';
import * as spec from "./spec";

let results = runTests(spec);
printResults(results);
