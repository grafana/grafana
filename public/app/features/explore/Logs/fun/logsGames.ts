import { useEffect, useState } from "react";

import { LogLevel, LogRowModel } from "@grafana/data";
import { createLogRow } from "app/features/logs/components/mocks/logRow";

const map = `Score: 000000                              Lives: ♥♥♥♥
================================================================================
                                                                                
                                   [=U=]        
                                                                                
                                                                                
      <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>
      [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]
      <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>
      <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>
                                                                                
                                                                                
            ###              ###              ###              ###            
           #####            #####            #####            #####           
          #######          #######          #######          #######          
           #####            #####            #####            #####           
            ###              ###              ###              ###            
                                                                                
                                                                                

                                                                             
                                       /A\\                                                                                   
================================================================================`;


export function useLogsGames() {
  const [gameState, setGameState] = useState<LogRowModel[] | undefined>(undefined);

  useEffect(() => {
    const logs = map.split('\n').map((row, index) => createLogRow({
      uid: index.toString(),
      entry: row.padEnd(80),
      timeEpochMs: 0,
      logLevel: LogLevel.unknown,
    }));
    setGameState(logs);
  }, []);
  
  return gameState;
}
