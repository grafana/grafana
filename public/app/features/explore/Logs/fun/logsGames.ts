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

const player = '/A\\';

export function useLogsGames() {
  const [gameState, setGameState] = useState<LogRowModel[] | undefined>(undefined);
  const [playerPosition, setPlayerPosition] = useState(39);

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        scheduleUpdate(() => {
          setPlayerPosition(Math.max(playerPosition-1, 0));
        });
      } else if (e.key === 'ArrowRight') {
        scheduleUpdate(() => {
          setPlayerPosition(Math.min(playerPosition+1, 80));
        });
      }
    }

    document.addEventListener('keydown', handleKeyPress);

    const logs = map.split('\n').map((row, index) => {
      if (index === 21) {
        row = row.padStart(playerPosition, ' ');
      }
      return createLogRow({
        uid: index.toString(),
        entry: row.padEnd(80),
        timeEpochMs: 0,
        logLevel: LogLevel.unknown,
      });
    });
    setGameState(logs);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    }
  }, [playerPosition]);
  
  return gameState;
}

let pendingFrame: number | null = null;

function scheduleUpdate(updateFn: () => void) {
  if (pendingFrame !== null) {
    cancelAnimationFrame(pendingFrame);
  }
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = null;
    updateFn();
  });
}
